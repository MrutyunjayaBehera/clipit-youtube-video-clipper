const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 5000;

app.use(cors({
	origin: 'http://127.0.0.1:5500',  // Frontend URL
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/clips', express.static(path.join(__dirname, 'clips')));

// Create clips folder if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'clips'))) {
	fs.mkdirSync(path.join(__dirname, 'clips'));
}

app.post('/generate_clip', (req, res) => {
    const { ytLink, startTime, endTime } = req.body || {};
    if (!ytLink || !startTime || !endTime) {
        return res.status(400).json({ success: false, error: 'Missing ytLink/startTime/endTime' });
    }

    const fileId = Date.now();
    const tempFile = `temp_${fileId}`;  // Base filename without extension
    const tempPath = path.join(__dirname, tempFile);
    const finalFile = `clip_${fileId}.mp4`;
    const finalPath = path.join(__dirname, 'clips', finalFile);

    // Clean up any existing temp files
    fs.readdir(__dirname, (err, files) => {
        if (!err) {
            files.forEach(file => {
                if (file.startsWith('temp_')) {
                    fs.unlink(path.join(__dirname, file), () => {});
                }
            });
        }
    });

    console.log(`▶️ Running yt-dlp for ${ytLink}`);
    
    const ytDlp = spawn('yt-dlp', [
        '--force-overwrites',
        '--no-continue',
        '--format', 'best[ext=mp4]/best',  // Prefer MP4 format
        '--no-playlist',
        '--no-part',
        '--retries', '3',
        '--fragment-retries', '3',
        '-o', tempPath + '.%(ext)s',  // Let yt-dlp append the correct extension
        ytLink
    ]);

    ytDlp.stdout.on('data', (data) => {
        console.log(`yt-dlp output: ${data}`);
    });

    ytDlp.stderr.on('data', (data) => {
        console.error(`yt-dlp stderr: ${data}`);
    });

    ytDlp.on('error', (error) => {
        console.error('❌ yt-dlp process error:', error);
        return res.status(500).json({ success: false, error: 'yt-dlp failed', details: error.message });
    });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp process exited with code ${code}`);
            return res.status(500).json({ success: false, error: 'yt-dlp failed', details: `Process exited with code ${code}` });
        }

        // Find the actual downloaded file
        fs.readdir(__dirname, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                return res.status(500).json({ success: false, error: 'Failed to find downloaded file' });
            }

            const downloadedFile = files.find(file => file.startsWith(tempFile) && !file.endsWith('.part') && !file.endsWith('.ytdl'));
            if (!downloadedFile) {
                console.error('Downloaded file not found');
                return res.status(500).json({ success: false, error: 'Downloaded file not found' });
            }

            const downloadedPath = path.join(__dirname, downloadedFile);
            console.log('✅ YouTube download complete, starting ffmpeg conversion...');

            const ffmpeg = spawn('ffmpeg', [
                '-i', downloadedPath,
                '-ss', startTime,
                '-to', endTime,
                '-c:v', 'libx264',
                '-preset', 'medium',      // Balance between quality and encoding speed
                '-crf', '18',            // Lower CRF = Higher quality (range 0-51, 18 is visually lossless)
                '-b:v', '5M',            // Video bitrate
                '-maxrate', '7M',        // Maximum bitrate
                '-bufsize', '10M',       // Buffer size
                '-c:a', 'aac',
                '-b:a', '192k',          // Audio bitrate
                '-movflags', '+faststart',
                finalPath
            ]);

            ffmpeg.stdout.on('data', (data) => {
                console.log(`ffmpeg output: ${data}`);
            });

            ffmpeg.stderr.on('data', (data) => {
                console.error(`ffmpeg stderr: ${data}`);
            });

            ffmpeg.on('error', (error) => {
                console.error('❌ ffmpeg process error:', error);
                fs.unlink(downloadedPath, () => {});
                return res.status(500).json({ success: false, error: 'ffmpeg failed', details: error.message });
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error(`ffmpeg process exited with code ${code}`);
                    fs.unlink(downloadedPath, () => {});
                    return res.status(500).json({ success: false, error: 'ffmpeg failed', details: `Process exited with code ${code}` });
                }

                fs.unlink(downloadedPath, () => {
                    console.log('🧹 Temp file deleted:', downloadedPath);
                });

                console.log(`✅ Final MP4 ready: ${finalFile}`);
                res.json({
                    success: true,
                    message: 'Clip ready',
                    file: finalFile,
                    downloadUrl: `http://localhost:${PORT}/clips/${finalFile}`
                });
            });
        });
    });
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
