const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const fileListContainer = document.getElementById('file-list-container');
const mergeBtn = document.getElementById('merge-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const resultArea = document.getElementById('result-area');
const downloadLink = document.getElementById('download-link');

let filesArray = [];

// Drag & Drop Events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFiles, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files: files } });
}

function handleFiles(e) {
    const files = [...e.target.files];
    const pptxFiles = files.filter(file => file.name.endsWith('.pptx'));
    
    if (pptxFiles.length === 0 && files.length > 0) {
        alert('Por favor, selecciona solo archivos .pptx');
        return;
    }

    filesArray = [...filesArray, ...pptxFiles];
    updateFileList();
}

function updateFileList() {
    fileList.innerHTML = '';
    
    if (filesArray.length > 0) {
        fileListContainer.style.display = 'block';
        mergeBtn.disabled = false;
        
        filesArray.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            li.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="remove-file" onclick="removeFile(${index})">×</span>
            `;
            fileList.appendChild(li);
        });
    } else {
        fileListContainer.style.display = 'none';
        mergeBtn.disabled = true;
    }
}

function removeFile(index) {
    filesArray.splice(index, 1);
    updateFileList();
}

window.removeFile = removeFile; // Make accessible to inline onclick

mergeBtn.addEventListener('click', uploadAndMerge);

async function uploadAndMerge() {
    if (filesArray.length === 0) return;

    loadingOverlay.style.display = 'flex';
    const formData = new FormData();
    
    filesArray.forEach(file => {
        formData.append('files', file);
    });

    try {
        // Use relative path so it works both on localhost and deployed Render URL
        const response = await fetch('/merge', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            
            // Success
            loadingOverlay.style.display = 'none';
            resultArea.style.display = 'block';
            dropZone.style.display = 'none';
            fileListContainer.style.display = 'none';
            mergeBtn.style.display = 'none';
            document.querySelector('header p').innerText = "¡Fusión completada!";
            
            // Download link works with relative path since we are serving static files
            downloadLink.href = data.downloadUrl;
        } else {
            throw new Error('Error en la fusión');
        }
    } catch (error) {
        console.error(error);
        loadingOverlay.style.display = 'none';
        alert('Hubo un error al unir los archivos. Asegúrate de que son archivos PPTX válidos.');
    }
}
