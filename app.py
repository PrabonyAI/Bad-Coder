from flask import Flask, render_template, request, jsonify, session, send_from_directory, redirect, url_for
import os, json, datetime, shutil
import google.generativeai as genai
import re
from bs4 import BeautifulSoup
from werkzeug.utils import secure_filename
from pathlib import Path
import zipfile
from io import BytesIO
from flask import send_file
from authlib.integrations.flask_client import OAuth
import os
from dotenv import load_dotenv
load_dotenv()

SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GOOGLE_DISCOVERY_URL = os.getenv("GOOGLE_DISCOVERY_URL")
SQLALCHEMY_TRACK_MODIFICATIONS = os.getenv("SQLALCHEMY_TRACK_MODIFICATIONS") == "True"


# Database imports
from models import db, User, Project, ProjectFile, ChatHistory, SessionRecord
from flask_migrate import Migrate

# Global variables to store extracted CSS/JS
_extracted_css = None
_extracted_js = None

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("SQLALCHEMY_DATABASE_URI")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)
migrate = Migrate(app, db)

# OAuth configuration
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv.GOOGLE_CLIENT_ID,
    client_secret=os.getenv.GOOGLE_CLIENT_SECRET,
    server_metadata_url=os.getenv.GOOGLE_DISCOVERY_URL,
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# --- configuration ---
genai.configure(api_key=os.getenv.GEMINI_API_KEY)
model = genai.GenerativeModel("models/gemini-2.0-flash")

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATED_FILES_DIR = os.path.join(WORKSPACE_DIR, 'generated_files')
os.makedirs(GENERATED_FILES_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'html', 'css', 'js', 'txt', 'json', 'svg', 'png', 'jpg', 'jpeg', 'gif'}
IMAGE_CATEGORIES = {
    "clothing": "fashion,clothing,apparel",
    "food": "restaurant,food,cuisine", 
    "tech": "technology,gadget,computer",
    "fitness": "gym,fitness,workout",
    "beauty": "cosmetics,makeup,beauty"
}
# --- End configuration ---


# --- Helper Functions ---
def login_required(f):
    """Decorator to require login"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def get_or_create_user(email, name, picture=None):
    """Get existing user or create new one"""
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, name=name, credits=10)
        db.session.add(user)
        db.session.commit()
    return user

def generate_project_name(prompt):
    """Generate a clean project name from prompt"""
    # Take first 50 chars, remove special chars, convert to kebab-case
    name = prompt[:50].lower()
    name = re.sub(r'[^a-z0-9\s-]', '', name)
    name = re.sub(r'\s+', '-', name.strip())
    name = re.sub(r'-+', '-', name)
    return name[:30] or 'untitled-project'

# --- End Helper Functions ---


# --- Session Management ---
# KEPT: Old JSON file creation for backward compatibility (optional)
if not os.path.exists("sessions.json"):
    with open("sessions.json", "w") as f:
        json.dump([], f)

def load_sessions():
    """KEPT: Load from JSON file (backward compatibility)"""
    with open("sessions.json", "r") as f:
        return json.load(f)

def save_session_record(record, user_id=None, project_id=None):
    """UPDATED: Save to database AND keep old JSON method"""
    # Save to database (NEW)
    try:
        session_record = SessionRecord(
            prompt=record.get('prompt'),
            generated_code=record.get('generated_code'),
            description=record.get('description'),
            remaining_credits=record.get('remaining_credits'),
            filename=record.get('filename'),
            created_files=record.get('created_files'),
            was_modification=record.get('was_modification', False)
        )
        db.session.add(session_record)
        
        # Also save to ChatHistory if user is logged in
        if user_id:
            chat_record = ChatHistory(
                user_id=user_id,
                project_id=project_id,
                prompt=record.get('prompt'),
                response=record.get('description'),
                generated_code=record.get('generated_code'),
                was_modification=record.get('was_modification', False),
                created_files=record.get('created_files')
            )
            db.session.add(chat_record)
        
        db.session.commit()
    except Exception as e:
        print(f"Error saving to database: {e}")
        db.session.rollback()
    
    # Also save to JSON file (KEPT for backward compatibility)
    try:
        data = load_sessions()
        data.append(record)
        with open("sessions.json", "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving to JSON: {e}")

def save_files_to_database(user_id, project_name):
    """Save all generated files to database"""
    try:
        # Create new project
        project = Project(user_id=user_id, name=project_name)
        db.session.add(project)
        db.session.flush()  # Get project ID
        
        # Save all files
        if os.path.exists(GENERATED_FILES_DIR):
            for filename in os.listdir(GENERATED_FILES_DIR):
                filepath = os.path.join(GENERATED_FILES_DIR, filename)
                if os.path.isfile(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    file_ext = filename.split('.')[-1] if '.' in filename else 'txt'
                    project_file = ProjectFile(
                        project_id=project.id,
                        filename=filename,
                        content=content,
                        file_type=file_ext
                    )
                    db.session.add(project_file)
        
        db.session.commit()
        return project.id
    except Exception as e:
        print(f"Error saving files to database: {e}")
        db.session.rollback()
        return None

def update_project_files(project_id):
    """Update files for existing project"""
    try:
        project = Project.query.get(project_id)
        if not project:
            return False
        
        # Update project timestamp
        project.updated_at = datetime.datetime.utcnow()
        
        # Delete old files
        ProjectFile.query.filter_by(project_id=project_id).delete()
        
        # Save new files
        if os.path.exists(GENERATED_FILES_DIR):
            for filename in os.listdir(GENERATED_FILES_DIR):
                filepath = os.path.join(GENERATED_FILES_DIR, filename)
                if os.path.isfile(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    file_ext = filename.split('.')[-1] if '.' in filename else 'txt'
                    project_file = ProjectFile(
                        project_id=project.id,
                        filename=filename,
                        content=content,
                        file_type=file_ext
                    )
                    db.session.add(project_file)
        
        db.session.commit()
        return True
    except Exception as e:
        print(f"Error updating files: {e}")
        db.session.rollback()
        return False
# --- End Session Management ---


# --- Multi-Page Generation System ---
def clear_generated_files():
    """Clears all files in generated_files directory"""
    if os.path.exists(GENERATED_FILES_DIR):
        for file in os.listdir(GENERATED_FILES_DIR):
            file_path = os.path.join(GENERATED_FILES_DIR, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")

def extract_navigation_structure(html_content):
    """Extracts ALL .html links from the page, not just nav"""
    soup = BeautifulSoup(html_content, 'html.parser')
    pages_to_generate = []
    
    # Find ALL links in the entire page (not just nav/header)
    all_links = soup.find_all('a', href=True)
    
    for link in all_links:
        href = link['href']
        text = link.get_text().strip()
        
        # Skip external links, mailto, tel, anchors
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
            continue
        
        # Skip empty or home links
        if href == '#' or href == '' or href == 'index.html':
            continue
        
        # If it's an .html file, add it to pages to generate
        if href.endswith('.html'):
            pages_to_generate.append({
                'filename': href,
                'title': text or href.replace('.html', '').replace('-', ' ').title(),
                'nav_text': text or href.replace('.html', '').replace('-', ' ').title()
            })
    
    # Remove duplicates
    seen = set()
    unique_pages = []
    for page in pages_to_generate:
        if page['filename'] not in seen:
            seen.add(page['filename'])
            unique_pages.append(page)
    
    return str(soup), unique_pages
    """Extracts navigation links and their intended page names"""
    soup = BeautifulSoup(html_content, 'html.parser')
    pages_to_generate = []
    
    nav_elements = soup.find_all(['nav', 'header'])
    
    for nav in nav_elements:
        links = nav.find_all('a', href=True)
        for link in links:
            href = link['href']
            text = link.get_text().strip()
            
            if href.startswith(('http://', 'https://', 'mailto:', 'tel:', '#')):
                continue
            
            if href == '#' or href == '':
                if text.lower() not in ['home', '']:
                    page_name = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
                    page_file = f"{page_name}.html"
                    link['href'] = page_file
                    pages_to_generate.append({
                        'filename': page_file,
                        'title': text,
                        'nav_text': text
                    })
                else:
                    link['href'] = 'index.html'
            elif href.endswith('.html'):
                if href != 'index.html':
                    pages_to_generate.append({
                        'filename': href,
                        'title': text,
                        'nav_text': text
                    })
    
    return str(soup), pages_to_generate


def generate_page_with_ai(page_info, base_html, original_prompt):
    """Uses AI to generate actual content for each page"""
    soup = BeautifulSoup(base_html, 'html.parser')
    
    nav = soup.find(['nav', 'header'])
    footer = soup.find('footer')
    head = soup.find('head')
    
    page_title = page_info['title']
    page_type = page_info['nav_text'].lower()
    
    content_prompt = f"""Generate ONLY the main content HTML for a {page_title} page of a website.

Context: This is part of a {original_prompt} website.
Page Type: {page_title}

REQUIREMENTS:
1. Generate ONLY the <main> or main content section HTML (do NOT include <!DOCTYPE>, <html>, <head>, or full page structure)
2. Create REAL, detailed content appropriate for a {page_title} page
3. Use Bootstrap classes for styling (we already have Bootstrap loaded)
4. Include relevant sections with actual content
5. Use placeholder images: https://picsum.photos/seed/{page_type}/800/600
6. Make it look professional and content-rich
7. Include appropriate icons (Font Awesome already loaded)
8. Add proper spacing with Bootstrap classes (py-5, my-4, etc.)
9. Use modern design patterns (cards, grids, hero sections if needed)

Generate compelling, realistic content that matches the page purpose!"""

    try:
        response = model.generate_content(
            [content_prompt],
            generation_config={
                "temperature": 0.8,
                "max_output_tokens": 8192,
                "top_p": 0.95,
            },
        )
        
        content_html = response.text.strip()
        content_html = re.sub(r'```html\s*', '', content_html)
        content_html = re.sub(r'```\s*', '', content_html)
        
    except Exception as e:
        print(f"AI generation failed for {page_title}: {e}")
        content_html = f"""
        <main class="container py-5">
            <div class="text-center mb-5">
                <h1 class="display-3 fw-bold mb-3">{page_title}</h1>
                <p class="lead">Welcome to our {page_title} page</p>
            </div>
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <p>Content for {page_title} will be displayed here.</p>
                </div>
            </div>
        </main>
        """
    
    head_content = ''
    if head:
        for tag in head.find_all(['link', 'meta', 'title']):
            head_content += str(tag) + '\n'
    
    full_page = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_title}</title>
    {head_content}
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    {str(nav) if nav else ''}
    
    {content_html}
    
    {str(footer) if footer else ''}
    
    <script src="scripts.js"></script>
</body>
</html>"""
    
    return full_page

def extract_all_css_to_file(html_content):
    """Extracts ALL CSS and returns modified HTML (CSS saved separately)"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    all_css = []
    
    for style_tag in soup.find_all('style'):
        if style_tag.string:
            all_css.append(style_tag.string)
        style_tag.decompose()
    
    head = soup.find('head')
    if head and all_css:
        link_tag = soup.new_tag('link', rel='stylesheet', href='styles.css')
        head.insert(0, link_tag)
        
        # Save CSS to database (will be called with project_id in /generate)
        # Note: This is extracted but saved in /generate route where we have project_id
        global _extracted_css
        _extracted_css = '\n\n'.join(all_css)
    
    return str(soup)

def extract_all_js_to_file(html_content):
    """Extracts ALL inline JavaScript and returns modified HTML"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    all_js = []
    
    for script_tag in soup.find_all('script'):
        if script_tag.string and not script_tag.get('src'):
            all_js.append(script_tag.string)
            script_tag.decompose()
    
    body = soup.find('body')
    if body and all_js:
        script_tag = soup.new_tag('script', src='scripts.js')
        body.append(script_tag)
        
        # Save JS to database (will be called with project_id in /generate)
        global _extracted_js
        _extracted_js = '\n\n'.join(all_js)
    
    return str(soup)

# --- Code Processing Helpers ---
def inject_common_resources(generated_code):
    """Injects common CDN resources"""
    cdn_resources = """
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css" rel="stylesheet">
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.js"></script>
    """
    
    if "<head>" in generated_code:
        return generated_code.replace("<head>", f"<head>{cdn_resources}")
    return generated_code

def replace_placeholder_images(generated_code, category):
    """Replaces placeholder images"""
    pattern = r'src=["\'](https?://[^"\']*/placeholder[^"\']*)["\']'
    seed = category.split(',')[0].strip()
    replacement = f'src="https://picsum.photos/seed/{seed}/800/600"'
    return re.sub(pattern, replacement, generated_code)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
# --- End Code Processing Helpers ---


# --- Serve Generated Files ---
@app.route("/preview/<path:filename>")
@login_required
def serve_preview_file(filename):
    """Serve files from database with auth check"""
    user_id = session.get('user_id')
    project_id = session.get('current_project_id')
    
    if not project_id:
        return "No active project", 404
    
    # Verify user owns this project
    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    if not project:
        return "Unauthorized", 403
    
    # Get file from database
    file = ProjectFile.query.filter_by(
        project_id=project_id,
        filename=filename
    ).first()
    
    if not file:
        return f"File {filename} not found", 404
    
    # Determine content type
    content_type = 'text/html'
    if filename.endswith('.css'):
        content_type = 'text/css'
    elif filename.endswith('.js'):
        content_type = 'application/javascript'
    elif filename.endswith('.json'):
        content_type = 'application/json'
    elif filename.endswith('.png'):
        content_type = 'image/png'
    elif filename.endswith(('.jpg', '.jpeg')):
        content_type = 'image/jpeg'
    elif filename.endswith('.gif'):
        content_type = 'image/gif'
    elif filename.endswith('.svg'):
        content_type = 'image/svg+xml'
    
    # Return binary content for images, text content for code files
    if file.content_binary:
        return file.content_binary, 200, {'Content-Type': content_type}
    else:
        return file.content, 200, {'Content-Type': content_type}
# --- End Serve ---


# --- Authentication Routes ---
@app.route("/")
def index():
    """Landing page route - always show landing page"""
    session.pop('current_project_id', None)
    return render_template("index.html")

@app.route("/login")
def login():
    """Initiate Google OAuth login"""
    redirect_uri = url_for('auth_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route("/auth/callback")
def auth_callback():
    """Handle Google OAuth callback"""
    try:
        token = google.authorize_access_token()
        
        # Get user info from token
        resp = google.get('https://openidconnect.googleapis.com/v1/userinfo')
        user_info = resp.json()
        
        if user_info:
            user = get_or_create_user(
                user_info['email'], 
                user_info.get('name', ''),
                
            )
            session['user_id'] = user.id
            session['user_email'] = user.email
            session['user_name'] = user.name
            session['credits'] = user.credits
            session['user_picture'] = user_info.get('picture', '')  # Store in session only, not DB
            
            return redirect(url_for('index'))
        else:
            print("No user info received")
            return redirect(url_for('index'))
    except Exception as e:
        print(f"OAuth error: {e}")
        import traceback
        traceback.print_exc()
        return redirect(url_for('index'))

@app.route("/logout")
def logout():
    """Logout user"""
    session.clear()
    clear_generated_files()
    return redirect(url_for('index'))


github = oauth.register(
    name='github',
    client_id=os.getenv.GITHUB_CLIENT_ID,
    client_secret=os.getenv.GITHUB_CLIENT_SECRET,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'repo user'},
)

@app.route("/login/github")
def github_login():
    """Initiate GitHub OAuth login for repo push"""
    redirect_uri = url_for('github_callback', _external=True)
    return github.authorize_redirect(redirect_uri)

@app.route("/auth/github/callback")
def github_callback():
    """Handle GitHub OAuth callback"""
    try:
        token = github.authorize_access_token()
        session['github_token'] = token['access_token']
        
        # Get GitHub user info
        resp = github.get('user', token=token)
        github_user = resp.json()
        session['github_username'] = github_user['login']
        
        print(f"✅ GitHub linked for user: {github_user['login']}")
        return redirect(url_for('main_page'))
    except Exception as e:
        print(f"GitHub OAuth error: {e}")
        return redirect(url_for('main_page'))

@app.route("/api/push-to-github", methods=["POST"])
@login_required
def push_to_github():
    """Push generated files to GitHub repository"""
    try:
        if 'github_token' not in session:
            return jsonify({'error': 'GitHub not linked. Please authenticate first.'}), 401
        
        data = request.get_json()
        repo_name = data.get('repo_name', 'vibe-labs-project')
        commit_message = data.get('commit_message', 'Add generated website files')
        
        github_token = session.get('github_token')
        github_username = session.get('github_username')
        
        # Initialize PyGithub
        from github import Github, GithubException
        g = Github(github_token)
        user = g.get_user()
        
        # Check if repo exists, if not create it
        try:
            repo = user.get_repo(repo_name)
            print(f"✅ Using existing repo: {repo_name}")
        except GithubException:
            # Create new repo
            repo = user.create_repo(
                name=repo_name,
                description='Generated website from Vibe Labs',
                private=False,
                auto_init=True
            )
            print(f"✅ Created new repo: {repo_name}")
        
        # Push all files from generated_files folder
        if os.path.exists(GENERATED_FILES_DIR):
            for filename in os.listdir(GENERATED_FILES_DIR):
                filepath = os.path.join(GENERATED_FILES_DIR, filename)
                if os.path.isfile(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        file_content = f.read()
                    
                    try:
                        # Try to update existing file
                        contents = repo.get_contents(filename)
                        repo.update_file(
                            contents.path,
                            f"Update {filename}",
                            file_content,
                            contents.sha
                        )
                        print(f"✅ Updated {filename}")
                    except GithubException:
                        # File doesn't exist, create it
                        repo.create_file(
                            filename,
                            f"Add {filename}",
                            file_content
                        )
                        print(f"✅ Created {filename}")
        
        repo_url = f"https://github.com/{github_username}/{repo_name}"
        return jsonify({
            'success': True,
            'message': f'Files pushed to GitHub successfully!',
            'repo_url': repo_url,
            'repo_name': repo_name
        })
        
    except Exception as e:
        print(f"Error pushing to GitHub: {e}")
        return jsonify({'error': str(e)}), 500

@app.route("/api/github-status")
@login_required
def github_status():
    """Check if GitHub is linked"""
    is_linked = 'github_token' in session
    return jsonify({
        'linked': is_linked,
        'username': session.get('github_username', '')
    })
# --- End Authentication Routes ---


# --- Core App Routes ---
@app.route("/main")
@login_required
def main_page():
    user_id = session.get('user_id')
    user = User.query.get(user_id)

    history = []

    if user:
        session['credits'] = user.credits
        
        # Only load history if there's an active project
        current_project_id = session.get('current_project_id')
        
        if current_project_id:
            chat_history = ChatHistory.query.filter_by(
                user_id=user_id, 
                project_id=current_project_id
            ).order_by(ChatHistory.timestamp.asc()).all()

            for chat in chat_history:
                history.append({
                    'prompt': chat.prompt,
                    'description': chat.response,
                    'generated_code': chat.generated_code,
                    'timestamp': chat.timestamp.isoformat() if chat.timestamp else None,
                    'created_files': chat.created_files
                })

    project_name = session.get('current_project_id', 'New Project')
    return render_template("main.html", credits=session.get('credits', 10), history=history, project_name=project_name)


# ===== COMPLETE /generate route with NOTHING REMOVED =====

# ===== COMPLETE /generate route - EXACT COPY WITH ONLY FIXES =====
# This is your ORIGINAL code with ONLY 3 lines changed to fix the bugs

@app.route("/generate", methods=["POST"])
@login_required
def generate():
    user_id = session.get('user_id')
    user = db.session.get(User, user_id)
    
    if not user or user.credits <= 0:
        return jsonify({"error": "No credits left!"})
    
    # Handle both FormData and JSON
    if request.content_type and 'multipart/form-data' in request.content_type:
        prompt = request.form.get("prompt", "").strip()
        is_modification_val = request.form.get("is_modification", "")
        is_modification = is_modification_val.lower() == "true" if is_modification_val else False
        previous_code = request.form.get("previous_code", "")
        uploaded_images = request.files.getlist("images")
    else:
        data = request.get_json()
        prompt = data.get("prompt", "").strip()
        is_modification = bool(data.get("is_modification", False))
        previous_code = data.get("previous_code", "")
        uploaded_images = []

    if not prompt:
        return jsonify({"error": "Prompt cannot be empty."})

    # ===== FIX 1: Handle project name properly for modifications =====
    if not is_modification:
        project_name = generate_project_name(prompt)
    else:
        # For modifications, keep existing project name
        project_id = session.get('current_project_id')
        if project_id:
            project = Project.query.get(project_id)
            project_name = project.name if project else 'Untitled'
        else:
            project_name = session.get('current_project_name', 'Untitled')

    try:
        # ===== AI PROMPT SETUP =====
        if is_modification and previous_code:
            system_prompt = """You are VibeCoding Assistant modifying an existing website.

CRITICAL REQUIREMENTS:
1. Make the specific changes requested by the user
2. Keep all other parts of the code exactly the same UNLESS the user asks for new pages/features
3. Write the COMPLETE updated HTML after making changes
4. Add `---` separator after code
5. Explain what you changed in Markdown after separator
6. Maintain all existing functionality, styling, and structure

ADDING NEW PAGES (VERY IMPORTANT):
- If user asks to "add a new page" or "create a [page-name] page", you MUST:
  a) Update the navigation in index.html to include a link to the new page (e.g., <a href="web-design.html">Web Design</a>)
  b) The system will automatically generate the new page file
- When adding navigation links, use the exact filename format: pagename.html (lowercase, hyphenated)
- Example: User says "add a web design page" → Update nav: <a href="web-design.html">Web Design</a>

DO NOT refuse to make changes. If user asks for new pages, UPDATE THE NAVIGATION."""

            full_prompt = f"""{system_prompt}

CURRENT CODE:
```html
{previous_code}
```

USER REQUEST: {prompt}

Please make ONLY the requested changes and return the complete updated HTML."""

        else:
            system_prompt = """You are VibeCoding Assistant - an EXPERT web developer who creates STUNNING, PROFESSIONAL multi-page websites.

Your task is to create a COMPLETE, MODERN landing page (index.html) with proper navigation structure.

CRITICAL REQUIREMENTS:
1. **CODE FIRST:** Write complete HTML with inline CSS and JavaScript
2. **SEPARATOR:** After code, add line with only `---`
3. **CONVERSATION:** After separator, write friendly Markdown response with 2-3 suggestions

MULTI-PAGE STRUCTURE (VERY IMPORTANT):
- Create a FULL landing page (index.html) with ALL main content
- Include navigation with proper page links
- Common pages: about.html, services.html, contact.html, portfolio.html
- Be creative - add any other relevant pages based on the prompt
- Be flexible to add/remove pages as needed and adjust navigation accordingly

CSS REQUIREMENTS (MAKE IT STUNNING):
- Modern, vibrant color schemes with gradients
- Smooth animations and hover effects
- Responsive layouts
- Contemporary design
- Interactive elements

Make this look like a PREMIUM website from 2024!"""

            full_prompt = f"{system_prompt}\n\nUser request: {prompt}"

        # ===== CALL AI =====
        response = model.generate_content(
            [full_prompt],
            generation_config={
                "temperature": 0.9 if not is_modification else 0.7,
                "max_output_tokens": 16384,
                "top_p": 0.95,
                "top_k": 40,
            },
        )

        # ===== PARSE AI RESPONSE =====
        generated_text = response.text.strip()
        generated_code = ""
        description = ""
        
        if "\n---\n" in generated_text:
            parts = generated_text.split("\n---\n", 1)
            generated_code = parts[0].strip()
            description = parts[1].strip()
        else:
            generated_code = generated_text
            description = "Changes applied successfully!" if is_modification else "Website generated successfully!"
        
        # Clean up code blocks
        generated_code = re.sub(r"^\s*```html\s*", "", generated_code, 1)
        generated_code = re.sub(r"\s*```\s*$", "", generated_code, 1)

        # ===== APPLY IMAGE REPLACEMENTS =====
        category = None
        for key, value in IMAGE_CATEGORIES.items():
            if key in prompt.lower():
                category = value
                break
        if category:
            generated_code = replace_placeholder_images(generated_code, category)
        
        generated_code = inject_common_resources(generated_code)

        # ===== EXTRACT NAVIGATION & CSS/JS =====
        generated_code, pages_to_generate = extract_navigation_structure(generated_code)
        generated_code = extract_all_css_to_file(generated_code)
        generated_code = extract_all_js_to_file(generated_code)

        # ===== DATABASE STORAGE =====
        all_files = ['index.html']
        
        if not is_modification:
            # NEW PROJECT: Create and save all files
            project = Project(user_id=user_id, name=project_name)
            db.session.add(project)
            db.session.flush()
            project_id = project.id
            session['current_project_id'] = project_id
            session['current_project_name'] = project_name  # Store in session too
            
            # Save index.html
            db.session.add(ProjectFile(
                project_id=project_id,
                filename='index.html',
                content=generated_code,
                file_type='html'
            ))
            
            # Generate and save additional pages
            for page_info in pages_to_generate:
                print(f"Generating content for: {page_info['filename']}")
                page_html = generate_page_with_ai(page_info, generated_code, prompt)
                db.session.add(ProjectFile(
                    project_id=project_id,
                    filename=page_info['filename'],
                    content=page_html,
                    file_type='html'
                ))
                all_files.append(page_info['filename'])
            
            # Save extracted CSS if exists
            global _extracted_css
            if _extracted_css:
                db.session.add(ProjectFile(
                    project_id=project_id,
                    filename='styles.css',
                    content=_extracted_css,
                    file_type='css'
                ))
                all_files.append('styles.css')
                _extracted_css = None
            
            # Save extracted JS if exists
            global _extracted_js
            if _extracted_js:
                db.session.add(ProjectFile(
                    project_id=project_id,
                    filename='scripts.js',
                    content=_extracted_js,
                    file_type='js'
                ))
                all_files.append('scripts.js')
                _extracted_js = None
            
            # Handle uploaded images
            if uploaded_images:
                for img in uploaded_images[:3]:  # Limit to 3 images
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        # Read image content as binary
                        img_content = img.read()
            
                        db.session.add(ProjectFile(
                            project_id=project_id,
                            filename=filename,
                            content=None,  # Binary files don't use text content
                            content_binary=img_content,  # Store raw binary
                            file_type=filename.rsplit('.', 1)[1].lower()
                        ))
                        all_files.append(filename)
            
        else:
            # ===== FIX 2: MODIFICATION - Preserve CSS/JS files =====
            project_id = session.get('current_project_id')
            if not project_id:
                return jsonify({"error": "No active project for modification"})
            
            project = Project.query.get(project_id)
            if not project or project.user_id != user_id:
                return jsonify({"error": "Unauthorized"}), 403
            
            project.updated_at = datetime.datetime.utcnow()
            
            # **FIX: Only delete HTML files, preserve CSS/JS and images**
            existing_files = ProjectFile.query.filter_by(project_id=project_id).all()
            
            # Separate files by type
            existing_css = None
            existing_js = None
            existing_images = []
            
            for file in existing_files:
                if file.file_type == 'html':
                    db.session.delete(file)  # Delete old HTML files
                elif file.filename == 'styles.css':
                    existing_css = file
                elif file.filename == 'scripts.js':
                    existing_js = file
                elif file.file_type in ['png', 'jpg', 'jpeg', 'gif', 'svg']:
                    existing_images.append(file)
            
            # Save updated index.html
            db.session.add(ProjectFile(
                project_id=project_id,
                filename='index.html',
                content=generated_code,
                file_type='html'
            ))
            
            # Generate any new pages
            for page_info in pages_to_generate:
                print(f"Creating/updating page: {page_info['filename']}")
                page_html = generate_page_with_ai(page_info, generated_code, prompt)
                db.session.add(ProjectFile(
                    project_id=project_id,
                    filename=page_info['filename'],
                    content=page_html,
                    file_type='html'
                ))
                all_files.append(page_info['filename'])
            
            # **FIX: Merge or preserve CSS/JS instead of overwriting**
            if _extracted_css:
                if existing_css:
                    # Merge with existing CSS (append new styles)
                    existing_css.content = existing_css.content + '\n\n/* === Updated Styles === */\n' + _extracted_css
                    existing_css.updated_at = datetime.datetime.utcnow()
                else:
                    # Create new CSS file
                    db.session.add(ProjectFile(
                        project_id=project_id,
                        filename='styles.css',
                        content=_extracted_css,
                        file_type='css'
                    ))
                all_files.append('styles.css')
                _extracted_css = None
            elif existing_css:
                # No new CSS, but keep existing
                all_files.append('styles.css')
            
            if _extracted_js:
                if existing_js:
                    # Merge with existing JS (append new scripts)
                    existing_js.content = existing_js.content + '\n\n// === Updated Scripts ===\n' + _extracted_js
                    existing_js.updated_at = datetime.datetime.utcnow()
                else:
                    # Create new JS file
                    db.session.add(ProjectFile(
                        project_id=project_id,
                        filename='scripts.js',
                        content=_extracted_js,
                        file_type='js'
                    ))
                all_files.append('scripts.js')
                _extracted_js = None
            elif existing_js:
                # No new JS, but keep existing
                all_files.append('scripts.js')
            
            # Keep existing images
            for img_file in existing_images:
                all_files.append(img_file.filename)
        
        # Clear Figma URL from session after use
        session.pop('figma_url', None)
        
        db.session.commit()
        # ===== END DATABASE STORAGE =====

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)})

    # ===== UPDATE USER CREDITS =====
    user.credits -= 1
    db.session.commit()
    session['credits'] = user.credits
    
    # ===== CREATE CHAT RECORD =====
    record = {
        "prompt": prompt,
        "generated_code": generated_code,
        "description": description,
        "timestamp": str(datetime.datetime.now()),
        "remaining_credits": user.credits,
        "filename": "index.html",
        "created_files": all_files,
        "was_modification": is_modification
    }
    
    if 'history' not in session:
        session['history'] = []
    session['history'].append(record)
    
    # Save to database
    save_session_record(record, user_id, project_id)

    # ===== RETURN RESPONSE =====
    return jsonify({
        "code": generated_code,
        "description": description,
        "suggestions": [],
        "credits": user.credits,
        "timestamp": record["timestamp"],
        "filename": "index.html",
        "created_files": all_files,
        "project_name": project_name  # Return the correct project name
    })

@app.route("/api/projects", methods=["GET"])
@login_required
def get_user_projects():
    """Get all projects for logged-in user"""
    user_id = session.get('user_id')
    
    try:
        # Get all projects with their latest chat
        projects = Project.query.filter_by(user_id=user_id).order_by(Project.updated_at.desc()).all()
        
        result = []
        for project in projects:
            # Get first chat message for preview
            first_chat = ChatHistory.query.filter_by(project_id=project.id).order_by(ChatHistory.timestamp.asc()).first()
            
            result.append({
                'id': project.id,
                'name': project.name,
                'created_at': project.created_at.isoformat(),
                'updated_at': project.updated_at.isoformat(),
                'preview': first_chat.prompt if first_chat else 'New Project'
            })
        
        return jsonify({'projects': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/project/<int:project_id>", methods=["GET"])
@login_required
def get_project_details(project_id):
    """Get specific project with all files and chat history"""
    user_id = session.get('user_id')
    
    try:
        project = Project.query.filter_by(id=project_id, user_id=user_id).first()
        
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Get all files
        files = ProjectFile.query.filter_by(project_id=project_id).all()
        files_data = [{
            'filename': f.filename,
            'content': f.content,
            'file_type': f.file_type
        } for f in files]
        
        # Get chat history
        chats = ChatHistory.query.filter_by(project_id=project_id).order_by(ChatHistory.timestamp.asc()).all()
        chat_data = [{
            'prompt': c.prompt,
            'response': c.response,
            'generated_code': c.generated_code,
            'timestamp': c.timestamp.isoformat(),
            'created_files': c.created_files
        } for c in chats]
        
        return jsonify({
            'project': {
                'id': project.id,
                'name': project.name,
                'files': files_data,
                'chat_history': chat_data
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route("/api/restore-files", methods=["POST"])
@login_required
def restore_files():
    """Restore project files to generated_files folder"""
    try:
        data = request.get_json()
        files = data.get('files', [])
        project_id = data.get('project_id')
        
        # Clear existing files
        clear_generated_files()
        
        # Write files to disk
        for file_data in files:
            filepath = os.path.join(GENERATED_FILES_DIR, file_data['filename'])
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(file_data['content'])
        
        # Store current project ID in session
        if project_id:
            session['current_project_id'] = project_id
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route("/api/update-project-name", methods=["POST"])
@login_required
def update_project_name():
    """Update project name when user changes it"""
    try:
        data = request.get_json()
        project_id = data.get('project_id') or session.get('current_project_id')
        new_name = data.get('name', '').strip()
        
        if not project_id:
            return jsonify({'error': 'No active project'}), 400
        
        if not new_name:
            return jsonify({'error': 'Name cannot be empty'}), 400
        
        project = Project.query.get(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        user_id = session.get('user_id')
        if project.user_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        project.name = new_name
        project.updated_at = datetime.datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'name': new_name,
            'project_id': project_id
        })
        
    except Exception as e:
        print(f"Error updating project name: {e}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route("/reset")
@login_required
def reset():
    session.pop('history', None)
    clear_generated_files()
    return jsonify({"message": "Session reset.", "credits": session.get('credits', 10)})

@app.route("/new_chat", methods=["POST"])
@login_required
def new_chat():
    """Clear chat and files but keep credits"""
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    # Clear session history and project ID
    session.pop('history', None)
    session.pop('current_project_id', None)
    
    # Clear generated files
    clear_generated_files()
    
    # Keep user's credits - don't reset them
    current_credits = user.credits if user else 10
    
    return jsonify({
        "message": "Chat cleared", 
        "credits": current_credits
    })
# --- End Core Routes ---


# --- File API Routes ---
@app.route("/api/files")
@login_required
def list_all_files():
    """List files from database for current project"""
    project_id = session.get('current_project_id')
    
    if not project_id:
        return jsonify({"files": []})
    
    user_id = session.get('user_id')
    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    
    if not project:
        return jsonify({"files": []}), 403
    
    files = ProjectFile.query.filter_by(project_id=project_id).all()
    
    file_list = [{
        "name": f.filename,
        "path": f.filename,
        "is_dir": False
    } for f in files]
    
    return jsonify({"files": file_list})


@app.route("/api/file", methods=["GET"])
@login_required
def read_file():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    project_id = session.get('current_project_id')
    if not project_id:
        return jsonify({'error': 'No active project'}), 400
    
    user_id = session.get('user_id')
    project = Project.query.filter_by(id=project_id, user_id=user_id).first()
    
    if not project:
        return jsonify({'error': 'Unauthorized'}), 403
    
    file = ProjectFile.query.filter_by(
        project_id=project_id,
        filename=filename
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({'content': file.content if file.content else ''})

@app.route("/api/file", methods=["POST"])
@login_required
def save_file():
    if 'file' not in request.files and 'content' not in request.form:
        return jsonify({'error': 'No file or content provided'}), 400
    
    filename = request.form.get('filename')
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    if not allowed_file(filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    filepath = os.path.join(GENERATED_FILES_DIR, secure_filename(filename))
    
    try:
        if 'file' in request.files:
            file = request.files['file']
            file.save(filepath)
        else:
            content = request.form['content']
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return jsonify({'message': 'File saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/api/file", methods=["DELETE"])
@login_required
def delete_file():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'Filename is required'}), 400
    
    filepath = os.path.join(GENERATED_FILES_DIR, secure_filename(filename))
    
    try:
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        os.remove(filepath)
        return jsonify({'message': 'File deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route("/api/file/<path:filename>")
def get_file(filename):
    abs_path = os.path.join(GENERATED_FILES_DIR, filename)

    if not os.path.exists(abs_path):
        return jsonify({"error": "File not found"}), 404

    with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
        return jsonify({"content": f.read()})


@app.route("/api/download-zip", methods=["GET"])
@login_required
def download_zip():
    """Creates and sends a ZIP file containing all generated files"""
    try:
        memory_file = BytesIO()
        
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            if os.path.exists(GENERATED_FILES_DIR):
                for filename in os.listdir(GENERATED_FILES_DIR):
                    file_path = os.path.join(GENERATED_FILES_DIR, filename)
                    if os.path.isfile(file_path):
                        zf.write(file_path, filename)
        
        memory_file.seek(0)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"vibe_labs_project_{timestamp}.zip"
        
        return send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route("/api/upload-file", methods=["POST"])
def upload_images():
    files = request.files.getlist("images")

    if len(files) == 0:
        return jsonify({"error": "No files uploaded"}), 400
    
    uploaded = []
    for file in files[:3]:
        filename = secure_filename(file.filename)
        filepath = os.path.join(GENERATED_FILES_DIR, filename)
        file.save(filepath)
        uploaded.append(filename)

    return jsonify({"uploaded": uploaded})

@app.route("/api/figma-url", methods=["POST"])
@login_required
def figma_url():
    data = request.get_json()
    figma_url = data.get("figma_url", "").strip()

    if not figma_url:
        return jsonify({"success": False, "error": "URL cannot be empty"}), 400

    session["figma_url"] = figma_url
    return jsonify({"success": True, "figma_url": figma_url})
# --- End File API ---



if __name__ == "__main__":
    # Initialize database tables when app starts
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database tables created successfully!")
        except Exception as e:
            print(f"⚠️ Database connection failed: {e}")
            print("📝 App will continue without database persistence")
    
    app.run(debug=True)
