const authScreen = document.getElementById('auth-screen');
const albumSelectionScreen = document.getElementById('album-selection-screen');
const slideshowScreen = document.getElementById('slideshow-screen');
const loginButton = document.getElementById('login-button');
const albumGrid = document.getElementById('album-grid');
const slideshowContainer = document.getElementById('slideshow-container');
const backToAlbumsButton = document.getElementById('back-to-albums');

let tokenClient;
let accessToken;
let slideshowInterval;

function gisInitalized() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/photoslibrary.readonly',
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            showScreen('album-selection');
            loadAlbums();
        },
    });
}

loginButton.onclick = () => {
    // Force the consent screen to ensure correct scopes are requested.
    tokenClient.requestAccessToken({prompt: 'consent'});
};

backToAlbumsButton.onclick = () => {
    showScreen('album-selection');
    if (slideshowInterval) {
        clearInterval(slideshowInterval);
    }
};

function showScreen(screenName) {
    authScreen.style.display = 'none';
    albumSelectionScreen.style.display = 'none';
    slideshowScreen.style.display = 'none';

    if (screenName === 'auth') {
        authScreen.style.display = 'flex';
    } else if (screenName === 'album-selection') {
        albumSelectionScreen.style.display = 'block';
    } else if (screenName === 'slideshow') {
        slideshowScreen.style.display = 'block';
    }
}

async function apiRequest(url, method = 'GET', body = null) {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${accessToken}`);
    if (method === 'POST') {
        headers.append('Content-Type', 'application/json');
    }

    const response = await fetch(`https://photoslibrary.googleapis.com${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });

    if (response.status === 401) {
        showScreen('auth');
        // Simple re-auth. A more robust solution might refresh the token.
        alert('Session expired. Please connect again.');
        return null;
    }
    if (!response.ok) {
        const errorBody = await response.text();
        console.error('API request failed:', response.status, response.statusText, errorBody);
        alert(`API Error: ${response.status} ${response.statusText}. Check the console for more details.`);
        return null;
    }
    return response.json();
}

async function loadAlbums() {
    albumGrid.innerHTML = 'Loading albums...';
    let albums = [];
    let nextPageToken;
    try {
        do {
            const data = await apiRequest(`/v1/albums?pageSize=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`);
            if (data && data.albums) {
                albums = albums.concat(data.albums);
            }
            nextPageToken = data.nextPageToken;
        } while (nextPageToken);

        albumGrid.innerHTML = '';
        albums.filter(album => album.mediaItemsCount > 0).forEach(album => {
            const albumItem = document.createElement('div');
            albumItem.className = 'album-item';
            albumItem.onclick = () => startSlideshow(album.id);

            const thumbnail = document.createElement('img');
            thumbnail.src = `${album.coverPhotoBaseUrl}=w200-h150-c`;
            
            const title = document.createElement('p');
            title.textContent = album.title;

            albumItem.appendChild(thumbnail);
            albumItem.appendChild(title);
            albumGrid.appendChild(albumItem);
        });
    } catch (error) {
        console.error('Error loading albums:', error);
        albumGrid.innerHTML = 'Failed to load albums.';
    }
}

async function startSlideshow(albumId) {
    showScreen('slideshow');
    slideshowContainer.innerHTML = 'Loading photos...';
    let mediaItems = [];
    let nextPageToken;

    try {
        do {
            const data = await apiRequest('/v1/mediaItems:search', 'POST', {
                albumId: albumId,
                pageSize: 100,
                pageToken: nextPageToken,
            });
            if (data && data.mediaItems) {
                mediaItems = mediaItems.concat(data.mediaItems.filter(item => item.mimeType.startsWith('image/')));
            }
            nextPageToken = data.nextPageToken;
        } while (nextPageToken && mediaItems.length < 100); // Limit to first 100 for simplicity

        slideshowContainer.innerHTML = '';
        if (mediaItems.length === 0) {
            slideshowContainer.innerHTML = 'No photos found in this album.';
            return;
        }

        let currentIndex = 0;
        const images = mediaItems.map(item => {
            const img = new Image();
            img.src = `${item.baseUrl}=w${window.innerWidth}-h${window.innerHeight}`;
            slideshowContainer.appendChild(img);
            return img;
        });

        const showNextImage = () => {
            images.forEach((img, index) => {
                img.classList.remove('active');
            });
            images[currentIndex].classList.add('active');
            currentIndex = (currentIndex + 1) % images.length;
        };

        showNextImage();
        slideshowInterval = setInterval(showNextImage, 10000);

    } catch (error) {
        console.error('Error loading media items:', error);
        slideshowContainer.innerHTML = 'Failed to load photos.';
    }
}

// Load GSI script and then initialize
const gsiScript = document.createElement('script');
gsiScript.src = 'https://accounts.google.com/gsi/client';
gsiScript.async = true;
gsiScript.defer = true;
gsiScript.onload = gisInitalized;
document.body.appendChild(gsiScript);
