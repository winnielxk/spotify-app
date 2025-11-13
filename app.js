var redirect_uri = "https://winniesspotify.com/";
var client_id = '3629edd575284d0aa6671c69ae8fb3d3';
var client_secret = 'c086865ccb2b49718e078e6dab0c6a0b';
var access_token = null;
var refresh_token = null;
var currentPlaylist = "";
var savedTracks = [];
var allsavedTracks = [];
var savedTracksIds = [];
var selectedArtists = []; // Array to store selected artist names
var nextBatchLength = 0;
var ArtistTracks = [];
var playlistTracksIds = [];

const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const loading = document.getElementById("loading");
const progress = document.getElementById("progress");
const loginButton = document.getElementById("loginButton");
const createPlaylistButton = document.getElementById("createPlaylistButton");
const artistsContainer = document.getElementById("artistsContainer");
const showArtistsContainer = document.getElementById("showArtistsContainer");

async function fetchWebApi(endpoint, method, body) {
    let accessToken = localStorage.getItem("access_token");
    console.log("Access token is: " + accessToken);
    const refreshToken = localStorage.getItem("refresh_token");
    console.log("Refresh token is: " + refreshToken);

    if (!accessToken) {
        console.error("Access token not found");
        return null;
    }

    // Check if token is expired
    const expiration = parseInt(localStorage.getItem("token_expires_at"), 10);
    if (Date.now() >= expiration * 1000) {
        console.log("Token expired. Refreshing...");
        await refreshAccessToken();
        accessToken = localStorage.getItem("access_token"); // Get the updated access token
    }

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
    };

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(`https://api.spotify.com/${endpoint}`, options);

    if (res.status === 401) {
        console.log("Token expired or invalid, refreshing...");
        await refreshAccessToken();
        accessToken = localStorage.getItem("access_token"); // Get the updated access token
        headers.Authorization = `Bearer ${accessToken}`;
        options.headers = headers;
        return fetch(`https://api.spotify.com/${endpoint}`, options);
    }

    return await res.json();
}

async function refreshAccessToken() {
    console.log("Refreshing access token...");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
        console.error("No refresh token found - user needs to log in again");
        // Clear everything and force re-login
        localStorage.clear();
        window.location.href = "/";
        return null;
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: client_id,
        client_secret: client_secret,
    });

    try {
        const response = await fetch(TOKEN, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });

        if (response.ok) {
            const data = await response.json();
            const newAccessToken = data.access_token;
            const expiresIn = data.expires_in;

            localStorage.setItem("access_token", newAccessToken);
            
            // Update refresh token if a new one is provided
            if (data.refresh_token) {
                localStorage.setItem("refresh_token", data.refresh_token);
            }
            
            // Calculate the new expiration time
            const expiresAt = Date.now() + expiresIn * 1000;
            localStorage.setItem("token_expires_at", expiresAt);

            console.log("Access token refreshed successfully");
            return newAccessToken;
        } else {
            console.error("Failed to refresh access token:", response.status);
            // If refresh fails, clear and force re-login
            localStorage.clear();
            window.location.href = "/";
            return null;
        }
    } catch (error) {
        console.error("Error refreshing access token:", error);
        localStorage.clear();
        window.location.href = "/";
        return null;
    }
}

async function getTopArtists() {
    const artists = (await fetchWebApi(
        'v1/me/top/artists?time_range=long_term&limit=20', 'GET'
    )).items;
    return artists;
}

async function createPlaylist(tracksUri) {
    try {
        const { id: user_id } = await fetchWebApi('v1/me', 'GET');

        const playlist = await fetchWebApi(
            `v1/users/${user_id}/playlists`, 'POST', {
            "name": "For you",
            "description": generatePlaylistDescription(selectedArtists),
            "public": false
        },
        );

        if (!playlist || !playlist.id) {
            throw new Error("Playlist ID not found");
        }

        // Convert tracks URIs to objects with URIs
        const tracks = tracksUri.map(uri => ({ "uri": uri }));

        // Add tracks one by one to ensure they are added sequentially
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            await fetchWebApi(
                `v1/playlists/${playlist.id}/tracks`,
                'POST',
                { "uris": [track.uri] }, // Each track should be added as an array
                localStorage.getItem("access_token")
            );
        }

        return playlist;
    } catch (error) {
        console.error("Error creating playlist:", error);
        throw error;
    }
}

async function getSavedTracks(offset = 0) {
    const response = await fetchWebApi(
        `v1/me/tracks?limit=50&offset=${offset}`, 'GET'
    );

    const tracks = response.items;
    tracks.forEach(item => {
        const track = item.track; // Access the 'track' object
    });

    console.log("Saved Songs:", tracks);
    nextBatchLength = tracks.length; // Store the length of the next batch

    return tracks;
}

async function createPlaylist(tracksUri) {
    try {
        const { id: user_id } = await fetchWebApi('v1/me', 'GET');

        const playlist = await fetchWebApi(
            `v1/users/${user_id}/playlists`, 'POST', {
            "name": "For you",
            "description": generatePlaylistDescription(selectedArtists),
            "public": false
        },
        );

        if (!playlist || !playlist.id) {
            throw new Error("Playlist ID not found");
        }

        // Convert tracks URIs to objects with URIs
        const tracks = tracksUri.map(uri => ({ "uri": uri }));

        // Add tracks one by one to ensure they are added sequentially
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            await fetchWebApi(
                `v1/playlists/${playlist.id}/tracks`,
                'POST',
                { "uris": [track.uri] }, // Each track should be added as an array
                localStorage.getItem("access_token")
            );
        }

        return playlist;
    } catch (error) {
        console.error("Error creating playlist:", error);
        throw error;
    }
}

function generatePlaylistDescription(artists) {
    if (artists.length === 1) {
        return `A personalized playlist featuring ${artists[0]} and more`;
    } else if (artists.length === 2) {
        return `A personalized playlist featuring ${artists[0]}, ${artists[1]}, and more`;
    } else {
        return `A personalized playlist featuring ${artists[0]}, ${artists[1]}, ${artists[2]} and more`;

    }
}

async function getSavedTracks(offset = 0) {
    try {
        const response = await fetchWebApi(
            `v1/me/tracks?limit=50&offset=${offset}`, 'GET'
        );

        if (!response || !response.items) {
            console.log("No tracks found in response:", response);
            return []; // Return an empty array if no tracks found
        }

        const tracks = response.items;
        tracks.forEach(item => {
            const track = item.track; // Access the 'track' object
        });

        console.log("Saved Songs:", tracks);
        nextBatchLength = tracks.length; // Store the length of the next batch

        return tracks;
    } catch (error) {
        console.error("Error fetching saved tracks:", error);
        return []; // Return an empty array in case of error
    }
}

async function init() {
    // Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const header = document.querySelector(".artists-header");
    const titleHeader = document.getElementById("titleHeader");

    header.style.display = "none";
    titleHeader.style.display = "none";
    createPlaylistButton.style.display = "none";
    showArtistsContainer.style.display = "none";

    loading.style.display = "block";
    progress.style.display = "block";
    console.log("Fetching saved songs...");
    let offset = 0; // Initialize offset
    allsavedTracks = await getSavedTracks(offset); // Fetch first set of songs

    // Continue fetching until we get less than 50 songs or reach 2000
    while (nextBatchLength >= 1 && allsavedTracks.length < 2000) {
        offset += 50; // Increment offset
        const nextBatch = await getSavedTracks(offset); // Fetch next batch of songs
        allsavedTracks = allsavedTracks.concat(nextBatch); // Combine batches
    }

    // Limit to first 2000 tracks
    allsavedTracks = allsavedTracks.slice(0, 2000);

    console.log("All Saved Songs (up to 2000):", allsavedTracks); // Log all saved songs

    // Filter saved tracks based on selected artists
    const selectedTracks = allsavedTracks.filter(track => {
        return selectedArtists.includes(track.track.artists[0].name);
    });

    console.log("Selected Tracks:", selectedTracks); // Log selected tracks

    // Create a map to store all tracks by each selected artist
    const artistTracksMap = new Map();
    selectedArtists.forEach(artist => {
        const tracksByArtist = selectedTracks.filter(track => track.track.artists[0].name === artist).map(track => track.track);
        artistTracksMap.set(artist, tracksByArtist);
    });

    console.log("Artist Tracks Map:", artistTracksMap); // Log artist tracks map

    // Clear existing playlistTracksIds
    playlistTracksIds = [];

    for (const [artist, tracks] of artistTracksMap) {
        // Get 3 random tracks from the artist's saved tracks
        const randomArtistTracks = getRandomTracks(tracks, 3);
        console.log("Random Tracks for", artist, ":", randomArtistTracks);

        for (const track of randomArtistTracks) {
            console.log(`${track.name} by ${track.artists.map(artist => artist.name).join(', ')}`);

            // Get recommendations for each random track
            const recommendations = await getRecommendations(track.id);
            if (recommendations.length > 0) {
                const recommendedTrack = recommendations[0]; // Get the first recommendation
                console.log("Recommended Track for", track.id, ":", recommendedTrack);
                playlistTracksIds.push(recommendedTrack.id); // Add recommended track ID to playlistTracksIds
            }
        }

        // Add random track IDs to playlistTracksIds
        playlistTracksIds.push(...randomArtistTracks.map(track => track.id));
    }

    console.log("Playlist Tracks IDs before shuffle:", playlistTracksIds); // Log playlist tracks IDs before shuffle

    // Shuffling the playlistTracksIds array
    shuffleArray(playlistTracksIds);

    console.log("Playlist Tracks IDs after shuffle:", playlistTracksIds); // Log playlist tracks IDs after shuffle

    // Creating playlist with playlistTracksIds
    const tracksUri = playlistTracksIds.map(trackId => `spotify:track:${trackId}`);

    // Create a playlist with the combined tracks
    const createdPlaylist = await createPlaylist(tracksUri);
    console.log("Created Playlist:", createdPlaylist);

    loading.style.display = "none";
    progress.style.display = "none";
    titleHeader.style.display = "block";

    // Display the playlist
    const playlistContainer = document.getElementById("playlistContainer");
    if (playlistContainer) {
        const playlistId = createdPlaylist.id; // Assuming createdPlaylist has the playlist ID
        const iframe = document.createElement("iframe");
        iframe.title = "Spotify Embed: Recommendation Playlist";
        iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.style.minHeight = "360px";
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        iframe.loading = "lazy";

        playlistContainer.appendChild(iframe);
    }
}

async function getRecommendations(trackId) {
    try {
        console.log("Getting recommendations for track:", trackId);
        
        const recommendations = await fetchWebApi(
            `v1/recommendations?limit=1&seed_tracks=${trackId}&market=US`, 
            'GET'
        );
        
        console.log("Recommendations response:", recommendations);
        
        if (recommendations && recommendations.tracks && recommendations.tracks.length > 0) {
            return recommendations.tracks;
        }
        
        return [];
    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

async function getRecommendationsForArtist(artistTracks) {
    // Get random tracks from the artist's saved tracks
    const randomTracks = getRandomTracks(artistTracks, 3); // Get 3 random tracks
    return randomTracks;
}

function getRandomTracks(tracks, count) {
    if (tracks.length <= count) {
        return tracks;
    }
    const shuffled = tracks.sort(() => 0.5 - Math.random()); // Shuffle the array
    return shuffled.slice(0, count); // Get the first 'count' items
}

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function getCode() {
    let code = null;
    const queryString = window.location.search;
    if (queryString.length > 0) {
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code')
    }
    return code;
}

function requestAuthorization() {
    localStorage.setItem("client_id", client_id);
    localStorage.setItem("client_secret", client_secret); // In a real app you should not expose your client_secret to the user

    let url = AUTHORIZE;
    url += "?client_id=" + client_id;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirect_uri);
    url += "&show_dialog=true";
    url += "&scope=playlist-modify-public playlist-modify-private user-read-private user-read-email user-library-read user-top-read user-read-recently-played user-read-currently-playing";
    window.location.href = url; // Show Spotify's authorization screen
}







function showArtists() {
    const start = document.getElementById("start");
    const getStartedButton = document.getElementById("getStartedButton");
    const artistsContainer = document.getElementById("showArtistsContainer"); // Add this line

    start.style.display = "none";
    getStartedButton.style.display = "none";

    getTopArtists().then(topArtists => {
        if (!artistsContainer) return;

        // Create header element
        const header = document.createElement("h2");
        header.textContent = "Select Your Favorite Artists";
        header.classList.add("artists-header");

        // Get the parent element of artistsContainer
        const parentElement = artistsContainer.parentElement;

        // Insert the header before the artistsContainer
        parentElement.insertBefore(header, artistsContainer);

        // Clear existing content
        artistsContainer.innerHTML = "";

        // Create elements for each artist
        topArtists.forEach(artist => {
            const artistElement = document.createElement("div");
            artistElement.classList.add("artists");
            artistElement.dataset.artistName = artist.name; // Store artist name as dataset

            const nameElement = document.createElement("div");
            nameElement.textContent = artist.name;
            nameElement.classList.add("artist-name");

            const imageElement = document.createElement("img");
            if (artist.images.length > 0) {
                imageElement.src = artist.images[0].url; // Use the first image
            }
            imageElement.classList.add("artist-image");

            // Add click event listener to artist element
            artistElement.addEventListener("click", () => {
                toggleArtistSelection(artistElement, artist.name);
            });

            // Append elements to the container
            artistElement.appendChild(imageElement);
            artistElement.appendChild(nameElement);
            artistsContainer.appendChild(artistElement);
        });
    }).catch(error => {
        console.error("Error fetching and displaying top artists:", error);
    });
}

function toggleArtistSelection(artistElement, artistName) {
    if (selectedArtists.includes(artistName)) {
        // Artist is already selected, remove from array and reset style
        const index = selectedArtists.indexOf(artistName);
        if (index > -1) {
            selectedArtists.splice(index, 1);
        }
        artistElement.classList.remove("selected");
    } else {
        // Artist is not selected, add to array and set style
        selectedArtists.push(artistName);
        artistElement.classList.add("selected");
    }

    if (selectedArtists.length >= 1) {
        createPlaylistButton.style.display = "block";
    } else {
        createPlaylistButton.style.display = "none";
    }

    console.log("Selected Artists:", selectedArtists);
}

// Call init function on page load if access token is available


function redirectToHomePage() {
    window.location.href = "http://127.0.0.1:5501/index.html";
}

async function displayTopTracks(timeRange) {
    const topTracks = await fetchWebApi(`v1/me/top/tracks?limit=50&time_range=${timeRange}`, 'GET');
    const tracksList = document.getElementById("topTracksList");

    // Iterate through the top tracks and create list items
    topTracks.items.forEach((track, index) => {
        const trackItem = document.createElement("li");
        trackItem.classList.add("track-item");

        // Create an anchor for the track
        const trackLink = document.createElement("a");
        trackLink.href = track.external_urls.spotify;
        trackLink.target = "_blank"; // Open link in a new tab
        trackLink.classList.add("track-link");

        // Create a div for the track
        const trackDiv = document.createElement("div");
        trackDiv.classList.add("track");

        // Create a div for the track number
        const trackNumberDiv = document.createElement("div");
        trackNumberDiv.classList.add("track-number");
        const trackNumber = document.createElement("span");
        trackNumber.textContent = index + 1;
        trackNumberDiv.appendChild(trackNumber);

        // Create an image element for the album artwork
        const albumImage = document.createElement("img");
        albumImage.src = track.album.images[0].url;
        albumImage.alt = "Album Artwork";
        albumImage.classList.add("album-image");

        // Create a div for track details
        const trackDetails = document.createElement("div");
        trackDetails.classList.add("track-details");

        // Create elements for track name and artist(s)
        const trackName = document.createElement("div");
        trackName.textContent = track.name;
        trackName.classList.add("track-name");

        const artists = document.createElement("div");
        artists.textContent = track.artists.map(artist => artist.name).join(', ');
        artists.classList.add("track-artists");

        // Append track number, album artwork, track name, and artist(s) to track div
        trackDiv.appendChild(trackNumberDiv);
        trackDiv.appendChild(albumImage);
        trackDetails.appendChild(trackName);
        trackDetails.appendChild(artists);
        trackDiv.appendChild(trackDetails);

        // Append track div to track link
        trackLink.appendChild(trackDiv);

        // Append track link to track item
        trackItem.appendChild(trackLink);

        // Append track item to tracks list
        tracksList.appendChild(trackItem);
    });
}

async function displayTopArtists(timeRange) {
    const topArtists = await fetchWebApi(`v1/me/top/artists?limit=50&time_range=${timeRange}`, 'GET');
    const artistsContainer = document.getElementById("artistsContainer");

    // Iterate through the top artists and create artist cards
    topArtists.items.forEach((artist, index) => {
        const artistCard = document.createElement("div");
        artistCard.classList.add("artist");

        // Create a div for the artist number
        const artistNumberDiv = document.createElement("div");
        artistNumberDiv.classList.add("artist-number");
        const artistNumber = document.createElement("span");
        artistNumber.textContent = index + 1;
        artistNumberDiv.appendChild(artistNumber);

        // Create an anchor for the artist's Spotify page
        const artistLink = document.createElement("a");
        artistLink.href = artist.external_urls.spotify;
        artistLink.target = "_blank"; // Open link in a new tab

        // Create a div for the artist image and name
        const artistContent = document.createElement("div");
        artistContent.classList.add("artist-content");

        // Create an image element for the artist picture
        const artistImage = document.createElement("img");
        artistImage.src = artist.images[0].url;
        artistImage.alt = "Artist Picture";
        artistImage.classList.add("artist-image");

        // Create a div for the artist name
        const artistName = document.createElement("div");
        artistName.textContent = artist.name;
        artistName.classList.add("artist-name");

        // Append artist image and name to the artist content div
        artistContent.appendChild(artistImage);
        artistContent.appendChild(artistName);

        // Append artist content to the artist link
        artistLink.appendChild(artistContent);

        // Append artist number and artist link to the artist card
        artistCard.appendChild(artistNumberDiv);
        artistCard.appendChild(artistLink);

        // Append artist card to the artists container
        artistsContainer.appendChild(artistCard);
    });
}

async function displayRecentTracks() {
    await displayCurrentlyPlayingTrack(); // Call to display currently playing track

    const recentTracks = await fetchWebApi('v1/me/player/recently-played?limit=50', 'GET');
    const tracksList = document.getElementById("recentList");

    // Iterate through the recent tracks and create list items
    recentTracks.items.forEach((track, index) => {
        const trackItem = document.createElement("div");
        trackItem.classList.add("track-item");

        // Create an anchor for the track
        const trackLink = document.createElement("a");
        trackLink.href = track.track.external_urls.spotify;
        trackLink.target = "_blank"; // Open link in a new tab
        trackLink.classList.add("track-link");

        // Create a div for the track
        const trackDiv = document.createElement("div");
        trackDiv.classList.add("track");

        // Create a div for the track number
        const trackNumberDiv = document.createElement("div");
        trackNumberDiv.classList.add("track-number");
        const trackNumber = document.createElement("span");
        trackNumber.textContent = index + 1;
        trackNumberDiv.appendChild(trackNumber);

        // Create an image element for the album artwork
        const albumImage = document.createElement("img");
        albumImage.src = track.track.album.images[0].url;
        albumImage.alt = "Album Artwork";
        albumImage.classList.add("album-image");

        // Create a div for track details
        const trackDetails = document.createElement("div");
        trackDetails.classList.add("track-details");

        // Create elements for track name, artist(s), and played_at time
        const trackName = document.createElement("div");
        trackName.textContent = track.track.name;
        trackName.classList.add("track-name");

        const artists = document.createElement("div");
        artists.textContent = track.track.artists.map(artist => artist.name).join(', ');
        artists.classList.add("track-artists");

        // Calculate played at date
        const playedAt = document.createElement("div");
        const playedDate = new Date(track.played_at);
        const currentDate = new Date();
        const yesterday = new Date(currentDate);
        yesterday.setDate(currentDate.getDate() - 1);

        let playedDateStr = '';
        if (isSameDate(playedDate, currentDate)) {
            playedDateStr = "Today";
        } else if (isSameDate(playedDate, yesterday)) {
            playedDateStr = "Yesterday";
        } else {
            playedDateStr = formatDate(playedDate);
        }

        // Format played time
        const playedTime = playedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        playedAt.textContent = `Played: ${playedDateStr} at ${playedTime}`;
        playedAt.classList.add("played");

        // Append track number, album artwork, track name, artist(s), and played_at to track div
        trackDiv.appendChild(trackNumberDiv);
        trackDiv.appendChild(albumImage);
        trackDetails.appendChild(trackName);
        trackDetails.appendChild(artists);
        trackDetails.appendChild(playedAt);
        trackDiv.appendChild(trackDetails);

        // Append track div to track link
        trackLink.appendChild(trackDiv);

        // Append track link to track item
        trackItem.appendChild(trackLink);

        // Append track item to tracksList
        tracksList.appendChild(trackItem);
    });
}

async function displayCurrentlyPlayingTrack() {
    try {
        const currentlyPlayingTrack = await fetchWebApi('v1/me/player/currently-playing', 'GET');
        const currentTrackElement = document.getElementById("recentList");

        // Check if currentlyPlayingTrack is empty or does not have the expected structure
        if (!currentlyPlayingTrack || !currentlyPlayingTrack.item) {
            throw new Error("No track is currently playing.");
        }

        const track = currentlyPlayingTrack.item;

        // Create a div for the track
        const trackDiv = document.createElement("div");
        trackDiv.classList.add("track");

        // Music bar animation
        const musicBar = document.createElement("div");
        musicBar.classList.add("now", "playing");
        musicBar.id = "music";
        musicBar.innerHTML = `
                    <span class="bar n1"></span>
                    <span class="bar n2"></span>
                    <span class="bar n3"></span>
                    <span class="bar n4"></span>
                    <span class="bar n5"></span>
                `;
        trackDiv.appendChild(musicBar);

        // Create a div for album artwork and track info
        const artworkAndInfoDiv = document.createElement("div");
        artworkAndInfoDiv.classList.add("artwork-info");

        // Create a div for album artwork
        const albumDiv = document.createElement("div");
        albumDiv.classList.add("album-div");

        // Create an image element for the album artwork
        const albumImage = document.createElement("img");
        albumImage.src = track.album.images[0].url;
        albumImage.alt = "Album Artwork";
        albumImage.classList.add("album-image");

        // Append album image to albumDiv
        albumDiv.appendChild(albumImage);

        // Create a div for track details
        const trackDetails = document.createElement("div");
        trackDetails.classList.add("track-details");

        // Create elements for track name and artist(s)
        const trackName = document.createElement("div");
        trackName.textContent = track.name;
        trackName.classList.add("track-name");

        const artists = document.createElement("div");
        artists.textContent = track.artists.map(artist => artist.name).join(', ');
        artists.classList.add("track-artists");

        // Append track name and artists to track details
        trackDetails.appendChild(trackName);
        trackDetails.appendChild(artists);

        // Append albumDiv and trackDetails to artworkAndInfoDiv
        artworkAndInfoDiv.appendChild(albumDiv);
        artworkAndInfoDiv.appendChild(trackDetails);

        // Create an anchor for the track
        const trackLink = document.createElement("a");
        trackLink.href = track.external_urls.spotify;
        trackLink.target = "_blank"; // Open link in a new tab
        trackLink.classList.add("track-link");

        // Append artworkAndInfoDiv to trackLink
        trackLink.appendChild(artworkAndInfoDiv);

        // Append trackLink to trackDiv
        trackDiv.appendChild(trackLink);

        // Append trackDiv to currentTrackElement
        currentTrackElement.appendChild(trackDiv);
    } catch (error) {
        return;
    }
}

function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

function formatDate(date) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const month = monthNames[date.getMonth()];
    const day = date.getDate();

    return `${month} ${day}`;
}

// Function to check if access token has expired
function isTokenExpired() {
    const tokenExpiration = parseInt(localStorage.getItem("token_expires_at"), 10);
    if (!tokenExpiration) {
        return true;
    }
    const now = Date.now();
    return now >= tokenExpiration;
}

function onPageLoad() {
    const code = getCode();
    const accessToken = localStorage.getItem("access_token");
    
    if (code) {
        // User just came back from Spotify authorization
        getToken(code);
    } else if (accessToken) {
        // User already has a valid token, modify the landing page for logged-in state
        const loginButton = document.getElementById("loginButton");
        const loginP = document.getElementById("loginp");
        
        if (loginButton) loginButton.style.display = "none";
        if (loginP) loginP.textContent = "Use the menu above to explore your Spotify data.";
        
        document.getElementById("header").style.display = "block";
    }
}

async function getToken(code) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
        client_id: client_id,
        client_secret: client_secret,
    });

    const response = await fetch(TOKEN, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
    });

    const data = await response.json();
    
    if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        
        const expiresIn = data.expires_in;
        const expiresAt = Date.now() + expiresIn * 1000;
        localStorage.setItem("token_expires_at", expiresAt);
        
        // Redirect to clean URL
        window.location.href = redirect_uri;
    }
}