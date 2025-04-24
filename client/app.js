document.getElementById('generateClip').addEventListener('click', function (e) {
	e.preventDefault();

	const ytLink = document.getElementById('ytLink').value;
	const startTime = document.getElementById('startTime').value;
	const endTime = document.getElementById('endTime').value;

	// Validate inputs
	if (!ytLink || !startTime || !endTime) {
		alert('Please fill in all fields');
		return;
	}

	// const videoPreview = document.getElementById('videoPreview');
	// videoPreview.src = ytLink;
	// videoPreview.style.display = 'block';

	// Display the video preview
	// const videoPlayer = document.getElementById('videoPlayer');
	// videoPlayer.src = `https://www.youtube.com/embed/${getYouTubeID(ytLink)}?start=${startTime}&end=${endTime}`;
	// videoPlayer.style.display = 'block';

	// Send request to backend to generate clip
	fetch('http://localhost:5000/generate_clip', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ytLink, startTime: Number(startTime), endTime: Number(endTime) }),
		keepalive: true
	})
		.then(response => response.json())
		.then((data) => {
			if (data.success) {
				// Display the download link
				const downloadLink = document.getElementById('downloadLink');
				downloadLink.href = data.downloadUrl;
				document.getElementById('downloadContainer').style.display = 'block';
			} else {
				alert('Error generating clip');
			}
		})
		.catch((error) => {
			console.error('Error:', error);
			alert('Failed to process the video:: ', error);
		});
});

function getYouTubeID(link) {
	try {
		const url = new URL(link);
		console.log(url, url.hostname)

		// Case 1: youtube.com/watch?v=abc123xyz9Q
		if (url.hostname.includes("youtube.com")) {
			return url.searchParams.get("v"); // Get the ?v= value
		}

		// Case 2: youtu.be/abc123xyz9Q
		if (url.hostname === "youtu.be") {
			return url.pathname.slice(1); // Skip the initial "/"
		}

		return null;
	} catch (err) {
		return null; // Invalid URL
	}
}
