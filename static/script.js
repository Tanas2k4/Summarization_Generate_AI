document.addEventListener('DOMContentLoaded', function() {
    const newChatBtn = document.getElementById('new-chat');
    const tabBar = document.getElementById('tab-bar');
    const chatArea = document.getElementById('chat-area');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const taskSelect = document.getElementById('task-select');
    const importBtn = document.getElementById('import-btn');
    const importModal = document.getElementById('import-modal');
    const urlInput = document.getElementById('url-input');
    const fileInput = document.getElementById('file-input');
    const cancelImportBtn = document.getElementById('cancel-import');
    const confirmImportBtn = document.getElementById('confirm-import');
    const modeToggle = document.getElementById('mode-toggle');
    const historyTabs = document.getElementById('history-tabs');

    let currentTabId = null;
    let tabCounter = 0;
    let chatHistory = {};

    newChatBtn.addEventListener('click', createNewTab);
    sendBtn.addEventListener('click', handleSend);
    taskSelect.addEventListener('change', handleTaskChange);
    importBtn.addEventListener('click', () => importModal.classList.remove('hidden'));
    cancelImportBtn.addEventListener('click', () => importModal.classList.add('hidden'));
    confirmImportBtn.addEventListener('click', handleImport);
    modeToggle.addEventListener('click', toggleDarkMode);

    function createNewTab() {
        tabCounter++;
        const tabId = `tab-${tabCounter}`;

        // Create tab button
        const tabButton = document.createElement('div');
        tabButton.className = 'flex items-center bg-white dark:bg-gray-800 px-4 py-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer';
        tabButton.innerHTML = `
        <span class="mr-2 tab-name text-text-light dark:text-text-dark" contenteditable="true">Chat ${tabCounter}</span>
        <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none">
            <i class="fas fa-times"></i>
        </button>
    `;
        tabBar.appendChild(tabButton);

        // Create history tab
        const historyTab = document.createElement('div');
        historyTab.className = 'mb-2 p-2 bg-gray-200 dark:bg-gray-700 rounded cursor-pointer';
        historyTab.innerHTML = `<span class="tab-name text-text-light dark:text-text-dark" contenteditable="true">Chat ${tabCounter}</span>`;
        historyTabs.appendChild(historyTab);

        chatHistory[tabId] = [];
        showTab(tabId);

        // Add click events
        tabButton.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                closeTab(tabId, tabButton, historyTab);
            } else if (!e.target.classList.contains('tab-name')) {
                showTab(tabId);
            }
        });

        historyTab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-name')) {
                showTab(tabId);
            }
        });

        // Add blur event for renaming
        const tabNames = [tabButton.querySelector('.tab-name'), historyTab.querySelector('.tab-name')];
        tabNames.forEach(tabName => {
            tabName.addEventListener('blur', () => {
                const newName = tabName.textContent.trim();
                tabNames.forEach(tn => tn.textContent = newName);
            });
            tabName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    tabName.blur();
                }
            });
        });
    }

// Update the showTab function to highlight the active tab
    function showTab(tabId) {
        currentTabId = tabId;
        chatArea.innerHTML = '';
        chatHistory[tabId].forEach(msg => addMessageToChat(msg.sender, msg.content));
        updateTaskSelect();

        // Highlight active tab
        document.querySelectorAll('#tab-bar > div').forEach(tab => {
            tab.classList.remove('bg-primary', 'text-white');
        });
        document.querySelectorAll('#history-tabs > div').forEach(tab => {
            tab.classList.remove('bg-primary', 'text-white');
        });

        const activeTabButton = document.querySelector(`#tab-bar > div:nth-child(${parseInt(tabId.split('-')[1])})`);
        const activeHistoryTab = document.querySelector(`#history-tabs > div:nth-child(${parseInt(tabId.split('-')[1])})`);

        if (activeTabButton) activeTabButton.classList.add('bg-primary', 'text-white');
        if (activeHistoryTab) activeHistoryTab.classList.add('bg-primary', 'text-white');
    }

    function closeTab(tabId, tabButton, historyTab) {
        tabButton.remove();
        historyTab.remove();
        delete chatHistory[tabId];

        const remainingTabs = Object.keys(chatHistory);
        if (remainingTabs.length > 0) {
            showTab(remainingTabs[remainingTabs.length - 1]);
        } else {
            chatArea.innerHTML = '';
            currentTabId = null;
        }
    }

    function handleSend() {
        const message = userInput.value.trim();
        if (!message || !currentTabId) return;

        addMessageToChat('user', message);
        userInput.value = '';

        const task = taskSelect.value;
        if (task === 'generate') {
            generate(message);
        } else {
            summarize(message);
        }
    }

    function handleTaskChange() {
        updateImportButton();
    }

    function updateImportButton() {
        importBtn.style.display = taskSelect.value === 'summarize' ? 'block' : 'none';
    }

    function handleImport() {
        const url = urlInput.value.trim();
        const file = fileInput.files[0];

        if (url) {
            importFromUrl(url);
        } else if (file) {
            importFromFile(file);
        }

        importModal.classList.add('hidden');
        urlInput.value = '';
        fileInput.value = '';
    }

    async function importFromUrl(url) {
        try {
            const response = await fetch('/import_url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const data = await response.json();
            addMessageToChat('system', `Imported content from URL: ${url}`);
            summarize(data.content);
        } catch (error) {
            addMessageToChat('system', `Error importing from URL: ${error.message}`);
        }
    }

    async function importFromFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload_file', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            addMessageToChat('system', `Uploaded file: ${file.name}`);
            summarize(data.content);
        } catch (error) {
            addMessageToChat('system', `Error uploading file: ${error.message}`);
        }
    }

    async function generate(prompt) {
        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await response.json();
            addMessageToChat('ai', data.generated);
        } catch (error) {
            addMessageToChat('system', `Error generating content: ${error.message}`);
        }
    }

    async function summarize(text) {
        try {
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            const data = await response.json();
            addMessageToChat('ai', data.summary);
        } catch (error) {
            addMessageToChat('system', `Error summarizing content: ${error.message}`);
        }
    }

    function addMessageToChat(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `mb-4 p-4 rounded ${sender === 'user' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : sender === 'ai' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`;
        messageDiv.textContent = content;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;

        if (currentTabId) {
            chatHistory[currentTabId].push({ sender, content });
        }
    }

    function updateTaskSelect() {
        const lastMessage = chatHistory[currentTabId][chatHistory[currentTabId].length - 1];
        if (lastMessage && lastMessage.sender === 'system' && lastMessage.content.includes('Imported content')) {
            taskSelect.value = 'summarize';
        } else {
            taskSelect.value = 'generate';
        }
        updateImportButton();
    }

    function toggleDarkMode() {
        const html = document.documentElement;  // Target the HTML element
        const icon = modeToggle.querySelector('i');

        html.classList.toggle('dark');  // Toggle dark mode on the root element

        if (html.classList.contains('dark')) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }


    // Initialize
    createNewTab();
    updateImportButton();
});