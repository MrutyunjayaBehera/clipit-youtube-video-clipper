const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use('/clips', express.static(path.join(__dirname, 'clips')));

// if folder dont exist
if (!fs.existsSync(path.join(__dirname, 'clips'))) {
	fs.mkdirSync(path.join(__dirname, 'clips'));
}

app.post('/generate_clip', (req, res) => {
	const { ytLink, startTime, endTime } = req.body || {};
	if (!ytLink || !startTime || !endTime) {
		return res.status(400).json({ success: false, error: 'Missing ytLink/startTime/endTime' });
	}

	const fileId = Date.now();
	const tempFile = `temp_${fileId}.webm`;
	const tempPath = path.join(__dirname, tempFile);
	const finalFile = `clip_${fileId}.mp4`;
	const finalPath = path.join(__dirname, 'clips', finalFile);

	const ytDlpCmd = `yt-dlp --download-sections "*${startTime}-${endTime}" -f "bv*+ba" -o "${tempPath}" "${ytLink}"`;

	console.log(`▶️ Running yt-dlp: ${ytDlpCmd}`);
	exec(ytDlpCmd, (error, stdout, stderr) => {
		if (error) {
			console.error('❌ yt-dlp failed:', error.message);
			return res.status(500).json({ success: false, error: 'yt-dlp failed', details: stderr });
		}

		// FFmpeg step to convert to .mp4
		const ffmpegCmd = `ffmpeg -i "${tempPath}" -ss 10 -to ${endTime-startTime+10} -c:v libx264 -c:a aac -movflags +faststart "${finalPath}"`;
		console.log(`🎬 Running ffmpeg: ${ffmpegCmd}`);

		exec(ffmpegCmd, (err, out, errout) => {
			if (err) {
				console.error('❌ ffmpeg failed:', err.message);
				return res.status(500).json({ success: false, error: 'ffmpeg failed', details: errout });
			}

			// Delete temp file
			fs.unlink(tempPath, () => {
				console.log('🧹 Temp file deleted:', tempPath);
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


app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
})