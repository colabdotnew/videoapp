let videoElement = document.getElementById('inputVideo');
let canvasElement = document.getElementById('outputCanvas');
let videoFileInput = document.getElementById('videoFileInput');
let processButton = document.getElementById('processButton');
let downloadButton = document.getElementById('downloadButton');
let statusDiv = document.getElementById('status');
let ctx = canvasElement.getContext('2d');

let videoStream = null; // To hold the MediaRecorder stream
let mediaRecorder;
let recordedChunks = [];
let isProcessing = false;

// Function called when OpenCV.js is loaded
function onOpenCvReady() {
    statusDiv.textContent = 'OpenCV.js loaded. Please select a video.';
    console.log('OpenCV.js is ready.');
    videoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const videoURL = URL.createObjectURL(file);
            videoElement.src = videoURL;
            videoElement.load();
            videoElement.onloadedmetadata = () => {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                processButton.disabled = false;
                statusDiv.textContent = `Video loaded: ${videoElement.videoWidth}x${videoElement.videoHeight}. Click 'Process Video' to start.`;
                downloadButton.style.display = 'none';
            };
        }
    });

    processButton.addEventListener('click', startProcessing);
    downloadButton.addEventListener('click', downloadProcessedVideo);
}

// Function to modify a single frame using OpenCV.js
function modifyFrame(srcMat) {
    // OpenCV.js works with BGR by default, but canvas.getImageData is RGBA.
    // So, we'll convert RGBA to BGR for OpenCV processing.
    let bgrMat = new cv.Mat();
    cv.cvtColor(srcMat, bgrMat, cv.COLOR_RGBA2BGR);

    // Apply color changes (mimicking your Python logic)
    let mask1 = new cv.Mat();
    let lowerBound1 = new cv.Scalar(0, 0, 0);
    let upperBound1 = new cv.Scalar(150, 150, 150);
    cv.inRange(bgrMat, lowerBound1, upperBound1, mask1);

    // Create a new color (0, 0, 0)
    let color0 = new cv.Scalar(0, 0, 0);
    // Set pixels in mask1 to (0, 0, 0)
    bgrMat.setTo(color0, mask1);

    mask1.delete(); // Clean up mask1

    let mask2 = new cv.Mat();
    let lowerBound2 = new cv.Scalar(100, 160, 200); // BGR for (200, 160, 100) RGB
    let upperBound2 = new cv.Scalar(120, 220, 250); // BGR for (250, 220, 120) RGB
    cv.inRange(bgrMat, lowerBound2, upperBound2, mask2);

    // Create a new color (255, 158, 0) RGB, which is (0, 158, 255) BGR
    let color1 = new cv.Scalar(0, 158, 255);
    // Set pixels in mask2 to (0, 158, 255)
    bgrMat.setTo(color1, mask2);

    mask2.delete(); // Clean up mask2

    // Convert BGR back to RGBA for canvas display
    let dstMat = new cv.Mat();
    cv.cvtColor(bgrMat, dstMat, cv.COLOR_BGR2RGBA);

    srcMat.delete(); // Clean up srcMat
    bgrMat.delete(); // Clean up bgrMat
    return dstMat;
}

function startProcessing() {
    if (isProcessing) return;
    isProcessing = true;
    processButton.disabled = true;
    downloadButton.style.display = 'none';
    statusDiv.textContent = 'Processing video... This may take a while.';

    videoElement.currentTime = 0; // Start from the beginning
    videoElement.play(); // Play the video to capture frames

    recordedChunks = [];
    // Use the canvas as a media stream source for recording
    videoStream = canvasElement.captureStream(30); // 30 fps, adjust if needed
    mediaRecorder = new MediaRecorder(videoStream, { mimeType: 'video/webm; codecs=vp8' }); // vp8 is widely supported

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        statusDiv.textContent = 'Processing complete. Video ready for download.';
        downloadButton.style.display = 'block';
        isProcessing = false;
        processButton.disabled = false;
        videoElement.pause(); // Ensure video is paused
    };

    mediaRecorder.onerror = (event) => {
        statusDiv.textContent = `Error during recording: ${event.error.name}`;
        isProcessing = false;
        processButton.disabled = false;
    };

    mediaRecorder.start();

    // The main loop for frame processing
    function processFrame() {
        if (videoElement.paused || videoElement.ended || !isProcessing) {
            if (isProcessing) { // If it ended naturally and we were processing
                mediaRecorder.stop();
            }
            return;
        }

        // Draw the current video frame to the canvas
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Get the image data from the canvas
        let imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
        let src = cv.matFromImageData(imageData);

        // Apply your modification logic
        let dst = modifyFrame(src);

        // Put the modified image data back to the canvas
        cv.imshow(canvasElement, dst); // OpenCV.js directly draws Mat to canvas

        src.delete(); // Clean up OpenCV Mat objects
        dst.delete();

        // Request the next frame
        requestAnimationFrame(processFrame);
    }

    // Start processing after a short delay to ensure video is ready
    setTimeout(() => {
        requestAnimationFrame(processFrame);
    }, 100);
}

function downloadProcessedVideo() {
    if (recordedChunks.length === 0) {
        alert('No processed video to download.');
        return;
    }
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = 'processed_video.webm';
    a.click();
    window.URL.revokeObjectURL(url);
    statusDiv.textContent = 'Download initiated.';
}

// Initial check if OpenCV.js is ready (in case it loads very quickly)
if (typeof cv !== 'undefined' && cv.onRuntimeInitialized) {
    onOpenCvReady();
}
