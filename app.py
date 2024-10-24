from flask import Flask, request, jsonify, render_template
from ai21 import AI21Client
from transformers import BartForConditionalGeneration, BartTokenizer
import torch
import pdfplumber
import os
import requests
from bs4 import BeautifulSoup
from ai21.models.chat import ChatMessage
import docx

app = Flask(__name__)

# Set up AI21 API client
ai21_client = AI21Client(api_key="19bbWiBpNcGf3hhpeLdxnW4gVfeAvpp5")

# Check if CUDA is available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Load BART model and tokenizer
tokenizer = BartTokenizer.from_pretrained("facebook/bart-large-xsum")
model = BartForConditionalGeneration.from_pretrained("facebook/bart-large-xsum").to(device)

# Summarize text using BART
def summarize_text(text):
    inputs = tokenizer(text, return_tensors="pt", max_length=1024, truncation=True).to(device)
    summary_ids = model.generate(inputs["input_ids"], max_length=150, min_length=30, length_penalty=2.0, num_beams=4, early_stopping=True)
    return tokenizer.decode(summary_ids[0], skip_special_tokens=True)

# Extract text from PDF file
def extract_text_from_pdf(file_path):
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text += page.extract_text()
    return text

# Extract text from a website
def extract_text_from_url(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    return ' '.join([p.get_text() for p in soup.find_all('p')])

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize():
    data = request.json
    text = data.get('text', '')
    summary = summarize_text(text)
    return jsonify({'summary': summary})

@app.route('/generate', methods=['POST'])
def generate():
    prompt = request.json.get('prompt', '')
    message = ChatMessage(role="user", content=prompt)
    response = ai21_client.chat.completions.create(
        model="jamba-1.5-large",
        messages=[message],
        documents=[],
        tools=[],
        n=1,
        max_tokens=2048,
        temperature=0.4,
        top_p=1,
        stop=[],
        response_format={"type": "text"},
    )
    generated_text = response.choices[0].message.content if response.choices else ''
    return jsonify({'generated': generated_text})

@app.route('/import_url', methods=['POST'])
def import_url():
    url = request.json.get('url', '')
    try:
        text = extract_text_from_url(url)
        return jsonify({'content': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/upload_file', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = file.filename
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        try:
            if filename.endswith('.pdf'):
                text = extract_text_from_pdf(file_path)
            elif filename.endswith('.docx'):
                text = extract_text_from_docx(file_path)
            elif filename.endswith('.txt'):
                with open(file_path, 'r') as f:
                    text = f.read()
            else:
                return jsonify({'error': 'Unsupported file type'}), 400
            os.remove(file_path)  # Remove the file after processing
            return jsonify({'content': text})
        except Exception as e:
            return jsonify({'error': str(e)}), 400

def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    return '\n'.join([para.text for para in doc.paragraphs])

if __name__ == '__main__':
    app.run(debug=False)