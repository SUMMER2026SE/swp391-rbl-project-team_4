const url = "https://www.youtube.com/watch?v=CnYzO-VCjUs";

let embedUrl = url;
try {
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(new URL(url.search ? url : url.replace('#', '?')).search);
        videoId = urlParams.get('v') || new URL(url).searchParams.get('v');
        if (!videoId) {
            // Fallback regex
            const match = url.match(/[?&]v=([^&]+)/);
            if (match) videoId = match[1];
        }
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/v/')) {
        videoId = url.split('youtube.com/v/')[1].split('?')[0];
    }
    if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
} catch (e) {
    console.error("Error parsing YouTube URL:", e);
    // Fallback to simple replace
    if (url.includes('youtube.com/watch?v=')) {
        embedUrl = url.replace('watch?v=', 'embed/');
        const ampersandPos = embedUrl.indexOf('&');
        if (ampersandPos !== -1) {
            embedUrl = embedUrl.substring(0, ampersandPos);
        }
    }
}
console.log("Result:", embedUrl);
