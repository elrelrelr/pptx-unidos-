const express = require('express');
const multer = require('multer');
const automizer = require('pptx-automizer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); // Serve frontend files

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function to count slides in a PPTX file
function getSlideCount(filePath) {
    try {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        let count = 0;
        zipEntries.forEach((entry) => {
            if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
                count++;
            }
        });
        return count;
    } catch (e) {
        console.error('Error reading PPTX zip:', e);
        return 0;
    }
}

app.post('/merge', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const outputDir = path.join(__dirname, 'public', 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFileName = `merged_${Date.now()}.pptx`;
    const outputPath = path.join(outputDir, outputFileName);
    const downloadUrl = `/output/${outputFileName}`;

    try {
        const pres = new automizer.Automizer({
            templateDir: 'uploads',
            outputDir: outputDir
        });

        // Use the first file as the base template or just start fresh?
        // pptx-automizer usually needs a root template. 
        // We will load the first file as root, keep its slides, and append others.
        // OR safer: load each file as a template and add all slides to a new empty logic?
        // Automizer allows loading a root file.
        
        // Strategy: 
        // 1. Identify all files.
        // 2. Add each file to Automizer manager.
        // 3. For each file, iterate its slides and add them.

        const files = req.files;
        
        // Rename files to have .pptx extension for automizer compatibility
        files.forEach(file => {
            const newPath = file.path + '.pptx';
            fs.renameSync(file.path, newPath);
            file.path = newPath;
            file.filename = file.filename + '.pptx';
        });

        // We need a "root" presentation. Let's use the first one.
        const rootFile = files[0];
        const presInstance = pres.loadRoot(rootFile.filename); 
        // Note: loadRoot takes the filename inside templateDir (which is 'uploads')

        // Count slides for the first file to know what we have kept?
        // Actually loadRoot keeps all slides by default? No, usually it just loads the *capability* to use it.
        // If we want to KEEP the slides from the root file, we might need to explicitly add them too, 
        // or check pptx-automizer behavior. 
        // Standard Automizer usage: `pres.addSlide('myTemplate', 1)`
        
        // Let's assume we treat ALL files (including the first one) as sources 
        // and we want to construct the final deck slide by slide.
        // But we need a base file to inherit styles/masters? 
        // Let's use the first file as base.
        
        // Important: `loadRoot` essentially says "This is the starting point". 
        // If we don't remove slides, they might stay?
        // "Automizer... loads a pptx file and lets you add slides..."
        // Use `pres.loadRoot(file).load(file2)...`
        
        // Let's add all files to be managed.
        for (const file of files) {
             // We already loaded rootFile, so skip if it is same? 
             // Automizer `.load` adds a file to the library.
             if(file.filename !== rootFile.filename) {
                 pres.load(file.filename);
             }
        }

        // Now add slides from each file in order.
        // Note: Automizer default output might contain original slides of Root?
        // It's safer to use a blank template if we want full control, but we don't have one.
        // So we use file 1.
        // We should PROBABLY not add file 1 slides again if they are already there.
        // But `loadRoot` usually keeps the content.
        
        // Wait, if I use file 1 as root, it starts with file 1 slides.
        // So I should append slides from file 2, file 3, etc.
        
        for (let i = 1; i < files.length; i++) {
            const file = files[i];
            const slideCount = getSlideCount(file.path);
            console.log(`File ${file.originalname} has ${slideCount} slides.`);
            
            for (let j = 1; j <= slideCount; j++) {
                pres.addSlide(file.filename, j);
            }
        }
        
        pres.write(outputFileName).then(summary => {
            console.log('Merge finished:', summary);
             // Cleanup uploads?
            // files.forEach(f => fs.unlinkSync(f.path)); // Optional: clean up later
            res.json({ success: true, downloadUrl: downloadUrl });
        }).catch(err => {
            console.error(err);
             res.status(500).json({ error: 'Merge failed during write.' });
        });

    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
