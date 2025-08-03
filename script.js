// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Switching Logic ---
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.className = savedTheme;
        updateThemeIcon(savedTheme);
    } else {
        body.className = 'light-theme';
        updateThemeIcon('light-theme');
    }

    themeSwitcher.addEventListener('click', () => {
        if (body.classList.contains('light-theme')) {
            body.classList.remove('light-theme');
            body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark-theme');
            updateThemeIcon('dark-theme');
        } else {
            body.classList.remove('dark-theme');
            body.classList.add('light-theme');
            localStorage.setItem('theme', 'light-theme');
            updateThemeIcon('light-theme');
        }
    });

    function updateThemeIcon(currentTheme) {
        const icon = themeSwitcher.querySelector('i');
        if (currentTheme === 'light-theme') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // --- Window Controls Logic ---
    const closeBtn = document.getElementById('close-btn');
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            window.electronAPI.maximizeWindow();
        });
    }

    // --- File Operations Logic (remains the same) ---
    const sourceDirInput = document.getElementById('source-dir');
    const destinationDirInput = document.getElementById('destination-dir');
    const browseSourceBtn = document.getElementById('browse-source');
    const browseDestinationBtn = document.getElementById('browse-destination');
    const organizeBtn = document.getElementById('organize-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const progressBar = document.querySelector('.progress-bar');
    const progressSizeLabel = document.getElementById('progress-size-label');
    const currentFileLabel = document.getElementById('current-file-label');

    let processedFilesInfo = null;

    function resetUI() {
        progressBar.style.width = '0%';
        progressSizeLabel.textContent = '0 B / 0 B';
        currentFileLabel.textContent = 'Ready';
        organizeBtn.textContent = 'Organize Files';
        organizeBtn.disabled = false;
        deleteBtn.textContent = 'Delete Source Files';
        deleteBtn.disabled = true;
    }

    sourceDirInput.value = localStorage.getItem('sourceDirPath') || '';
    destinationDirInput.value = localStorage.getItem('destinationDirPath') || '';
    
    sourceDirInput.addEventListener('change', () => {
        localStorage.setItem('sourceDirPath', sourceDirInput.value);
        resetUI();
    });
    destinationDirInput.addEventListener('change', () => {
        localStorage.setItem('destinationDirPath', destinationDirInput.value);
        resetUI();
    });
    
    resetUI();

    browseSourceBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.openDirectoryDialog();
        if (result) {
            sourceDirInput.value = result;
            localStorage.setItem('sourceDirPath', result);
            resetUI();
        }
    });

    browseDestinationBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.openDirectoryDialog();
        if (result) {
            destinationDirInput.value = result;
            localStorage.setItem('destinationDirPath', result);
            resetUI();
        }
    });

    organizeBtn.addEventListener('click', async () => {
        const sourcePath = sourceDirInput.value;
        const destinationPath = destinationDirInput.value;

        if (!sourcePath || !destinationPath) {
            alert('Please select both source and destination directories.');
            return;
        }

        organizeBtn.textContent = 'Organizing...';
        organizeBtn.disabled = true;
        deleteBtn.disabled = true;
        progressBar.style.width = '0%';
        progressSizeLabel.textContent = '0 B / 0 B';
        currentFileLabel.textContent = 'Initializing...';

        try {
            await window.electronAPI.organizeFiles(sourcePath, destinationPath);
        } catch (error) {
            alert('Failed to start organization: ' + error.message);
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!processedFilesInfo) {
            alert('No files were organized in the last operation to delete.');
            return;
        }

        const confirmDelete = confirm('Are you sure you want to delete the source files that were successfully moved? This action cannot be undone.');
        if (!confirmDelete) {
            return;
        }

        deleteBtn.textContent = 'Deleting...';
        deleteBtn.disabled = true;
        organizeBtn.disabled = true;
        currentFileLabel.textContent = 'Deleting source files...';

        try {
            await window.electronAPI.deleteSourceFiles(processedFilesInfo);
        } catch (error) {
            alert('Failed to start deletion: ' + error.message);
        } finally {
            deleteBtn.textContent = 'Delete Source Files';
            organizeBtn.disabled = false;
        }
    });

    window.electronAPI.onOrganizeStatus((data) => {
        currentFileLabel.textContent = data.message;
        progressBar.style.width = '0%';
        progressSizeLabel.textContent = `0 B / 0 B`;
    });

    window.electronAPI.onOrganizeProgress((data) => {
        const percentage = parseFloat(data.progress_percent).toFixed(2);
        progressBar.style.width = `${percentage}%`;
        progressSizeLabel.textContent = `${data.human_processed_size} / ${data.human_total_size}`;
        currentFileLabel.textContent = `Processing: ${data.current_file}`;
    });

    window.electronAPI.onOrganizeComplete((data) => {
        processedFilesInfo = data.processedFilesInfo;
        organizeBtn.textContent = 'Organize Files';
        organizeBtn.disabled = false;
        deleteBtn.disabled = false;
        progressBar.style.width = '100%';
        progressSizeLabel.textContent = 'Complete!';
        currentFileLabel.textContent = 'Operation Complete!';
    });

    window.electronAPI.onOrganizeError((data) => {
        alert('Error organizing files: ' + data.message);
        organizeBtn.textContent = 'Organize Files';
        organizeBtn.disabled = false;
        deleteBtn.disabled = true;
        currentFileLabel.textContent = 'Operation failed.';
        progressBar.style.width = '0%';
    });

    window.electronAPI.onDeleteStatus((data) => {
        currentFileLabel.textContent = data.message;
    });

    window.electronAPI.onDeleteProgress((data) => {
        currentFileLabel.textContent = data.message;
    });

    window.electronAPI.onDeleteComplete((data) => {
        alert(data.message);
        processedFilesInfo = null;
        resetUI();
    });

    window.electronAPI.onDeleteError((data) => {
        alert('Error deleting files: ' + data.message);
        deleteBtn.textContent = 'Delete Source Files';
        deleteBtn.disabled = false;
        organizeBtn.disabled = false;
        currentFileLabel.textContent = 'Deletion failed.';
    });

    // --- Update Button Logic ---
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            alert('Checking for updates...');
            try {
                await window.electronAPI.checkForUpdates();
            } catch (error) {
                alert('An error occurred while checking for updates.');
                console.error('Update check failed:', error);
            }
        });
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
});