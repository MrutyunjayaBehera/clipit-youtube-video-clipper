async function makeRequestWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

document.getElementById('generateClip').addEventListener('click', async function (e) {
    e.preventDefault();

    const generateButton = document.getElementById('generateClip');
    const loadingElement = document.getElementById('loading') || createLoadingElement();
    
    // Prevent multiple clicks while processing
    if (generateButton.disabled) return;

    const ytLink = document.getElementById('ytLink').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    // Validate inputs
    if (!ytLink || !startTime || !endTime) {
        alert('Please fill in all fields');
        return;
    }

    try {
        // Show loading state
        generateButton.disabled = true;
        loadingElement.style.display = 'block';
        
        const response = await fetch('http://localhost:5000/generate_clip', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ytLink, startTime: Number(startTime), endTime: Number(endTime) })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            // Display the download link
            const downloadLink = document.getElementById('downloadLink');
            downloadLink.href = data.downloadUrl;
            document.getElementById('downloadContainer').style.display = 'block';
            const videoPlayer = document.getElementById('videoPlayer');
            videoPlayer.src = data.downloadUrl;
            videoPlayer.style.display = 'block';
        } else {
            throw new Error(data.error || 'Error generating clip');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to process the video: ' + error.message);
    } finally {
        // Reset UI state
        generateButton.disabled = false;
        loadingElement.style.display = 'none';
    }
});

function createLoadingElement() {
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.innerHTML = 'Generating clip... This may take a few minutes...';
    loading.style.display = 'none';
    loading.style.margin = '10px 0';
    loading.style.color = '#666';
    document.getElementById('generateClip').parentNode.insertBefore(loading, document.getElementById('downloadContainer'));
    return loading;
}

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
