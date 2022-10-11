let peers = {};
let currentStream = new MediaStream();
let isConnect = false;
let rtcIceServerArray = [
    { urls: 'stun:stun.l.google.com:19302' },
];

let peerInited = {};
let signals = {};
let em = new EventEmitter();
let videoContainer = document.querySelector('#videoContainer');
em.on('peerInited', (id) => {
    signals[id]?.forEach(data => {
        peers[id].signal(data);
    });
    signals[id] = [];
});
let screenTrack;
let cameraTrack;
let audioTrack;

// addMedia(currentStream);

function getConfig() {
    return JSON.stringify({
        ENV: 'stage',
        ROOM_ID: 'nonumpa',
    });
}

function CreateOffer(receiverId) {
    peers[receiverId] = new SimplePeer({ initiator: true, trickle: true, config: { iceServers: rtcIceServerArray }, stream: currentStream });

    peers[receiverId].on('error', err => console.log('error', err));

    peers[receiverId].on('signal', data => {
        console.log('SIGNAL', JSON.stringify(data));
        GlobalUnityInstance.SendMessage('JSReceiver', 'JSOnSendOffer', JSON.stringify({ data: JSON.stringify(data), receiverId }));
    });


    peers[receiverId].on('connect', () => {
        console.log('CONNECT');
        peers[receiverId].send('whatever' + Math.random());

        let video = document.createElement('video');
        video.setAttribute('id', `video_${receiverId}`);
        video.setAttribute('autoplay', true);
        video.setAttribute('muted', true);
        video.setAttribute('poster', 'https://www.viewsonic.com/vsAssetFile/tw/img/resize/viewsonic-og-image_w640.webp');
        videoContainer.appendChild(video);
    });

    peers[receiverId].on('close', () => {
        peers[receiverId].destroy();
        console.log('DISCONNECT');
        delete peers[receiverId];
        delete peerInited[receiverId];
        document.getElementById(`video_${receiverId}`).remove();
    });

    peers[receiverId].on('data', data => {
        console.log('data: ' + data);
    });

    peers[receiverId].on('stream', stream => {
        console.log('onstream');
        // got remote video stream, now let's show it in a video tag
        let video = document.getElementById(`video_${receiverId}`);
        if ('srcObject' in video) {
            video.srcObject = stream;
        } else {
            video.src = window.URL.createObjectURL(stream); // for older browsers
        }
    });

}

function ReceiveAnswer(str, senderId) {
    if (!peers[senderId]) {
        return;
    }
    let jsonStr = JSON.parse(str);
    if (jsonStr.type === 'answer' && !peerInited[senderId]) {
        peers[senderId].signal(jsonStr);
        peerInited[senderId] = true;
        em.emit('peerInited', senderId);
    }
    else if (peerInited[senderId]) {
        console.log('ReceiveAnswer again', str);
        peers[senderId].signal(jsonStr);
    } else {
        signals[senderId].push(jsonStr);
    }
}

function ReceiveOffer(str, senderId) {
    let jsonStr = JSON.parse(str);
    if (jsonStr.type === 'offer' && !peerInited[senderId]) {
        // peers[senderId].destroy();
        // re-create a receive peer
        peers[senderId] = new SimplePeer({ trickle: true, config: { iceServers: rtcIceServerArray }, stream: currentStream });
        peers[senderId].on('error', err => console.log('error', err));

        peers[senderId].on('signal', data => {
            console.log('SIGNAL', JSON.stringify(data));
            GlobalUnityInstance.SendMessage('JSReceiver', 'JSOnSendAnswer', JSON.stringify({ data: JSON.stringify(data), receiverId: senderId }));
        });

        peers[senderId].on('connect', () => {
            console.log('CONNECT');
            peers[senderId].send('whatever' + Math.random());

            let video = document.createElement('video');
            video.setAttribute('id', `video_${senderId}`);
            video.setAttribute('autoplay', true);
            video.setAttribute('muted', true);
            video.setAttribute('poster', 'https://www.viewsonic.com/vsAssetFile/tw/img/resize/viewsonic-og-image_w640.webp');
            videoContainer.appendChild(video);
        });

        peers[senderId].on('close', () => {
            peers[senderId].destroy();
            console.log('DISCONNECT');
            delete peers[senderId];
            delete peerInited[senderId];
            document.getElementById(`video_${senderId}`).remove();
        });

        peers[senderId].on('data', data => {
            console.log('data: ' + data);
        });

        peers[senderId].on('stream', stream => {
            console.log('onstream');
            // got remote video stream, now let's show it in a video tag
            let video = document.getElementById(`video_${senderId}`);
            if ('srcObject' in video) {
                video.srcObject = stream;
            } else {
                video.src = window.URL.createObjectURL(stream); // for older browsers
            }
        });

        console.log('ReceiveOffer init', str);

        peers[senderId].signal(jsonStr);
        peerInited[senderId] = true;
        em.emit('peerInited', senderId);
    }
    else if (peerInited[senderId]) {
        console.log('ReceiveOffer again', str);
        peers[senderId].signal(jsonStr);
    } else {
        signals[senderId].push(jsonStr);
    }
}

function addMedia(stream) {
    Object.values(peers).forEach(p => p.addStream(stream));
    console.log('addMedia addStream');
}

function updateSelfVideo() {
    console.log('updateSelfVideo');
    let video = document.getElementById('video1');

    let videoStream = new MediaStream(screenTrack || cameraTrack);
    if ('srcObject' in video) {
        video.srcObject = videoStream;
    } else {
        video.src = window.URL.createObjectURL(videoStream); // for older browsers
    }
}

// boolean video
// boolean audio
async function getUserMedia(video, audio) {
    if (currentStream) {
        setAudioOnly(currentStream, audio);
        setVideoOnly(currentStream, video);
        if (audio) {
            screenTrack = (await getShareScreen()).getVideoTracks()[0];
            currentStream.addTrack(screenTrack);

            // currentStream.forEach(function (track) {
            // console.log(JSON.stringify(track));
            // if (track.readyState == 'live' && track.kind === 'video') {
            //     track.enabled = enabled;
            // }
            // });
        }
        else {
            // currentStream.getVideoTracks();
            // screenTrack.
            currentStream.removeTrack(screenTrack);
            screenTrack.stop();
        }
    }
    else {
        const stream = await getShareScreen();
        setAudioOnly(stream, audio);
        setVideoOnly(stream, video);   
    }
    updateSelfVideo();
}

// stop both mic and camera
function stopBothVideoAndAudio(stream) {
    stream.getTracks().forEach(function (track) {
        if (track.readyState == 'live') {
            track.stop();
        }
    });
}

// stop only camera
function setVideoOnly(stream, enabled) {
    console.log('setVideoOnly');
    stream.getTracks().forEach(function (track) {
        if (track.readyState == 'live' && track.kind === 'video') {
            track.enabled = enabled;
        }
    });
}

// stop only mic
function setAudioOnly(stream, enabled) {
    console.log('setAudioOnly');
    stream.getTracks().forEach(function (track) {
        if (track.readyState == 'live' && track.kind === 'audio') {
            track.enabled = enabled;
        }
    });
}

function setupVideoDefaultImage() {
    // set video element default image
    var videos = document.querySelectorAll('video');
    videos.forEach(element => {
        element.setAttribute('poster', 'https://www.viewsonic.com/vsAssetFile/tw/img/resize/viewsonic-og-image_w640.webp');
    });
}

async function getShareScreen(enabled) {
    if (enabled) {
        screenTrack = (await _getShareScreen()).getTracks()[0];
        currentStream.addTrack(screenTrack);
    }
    else {
        currentStream.removeTrack(screenTrack);
        screenTrack.stop();
        screenTrack = null;
    }
    updateSelfVideo();
}

async function getCamera(deviceId) {
    if (deviceId) {
        cameraTrack = (await _getMedia("video", deviceId)).getTracks()[0];
        currentStream.addTrack(cameraTrack);
    }
    else if (cameraTrack) {
        currentStream.removeTrack(cameraTrack);
        cameraTrack.stop();
        cameraTrack = null;
    }
    else {
        console.error("Error: no active camera");
    }
    updateSelfVideo();
}

async function getMicrophone(deviceId) {
    if (deviceId) {
        audioTrack = (await _getMedia("audio", deviceId)).getTracks()[0];
        currentStream.addTrack(audioTrack);
    }
    else if (audioTrack) {
        currentStream.removeTrack(audioTrack);
        audioTrack.stop();
        audioTrack = null;
    }
    else {
        console.error("Error: no active camera");
    }
}

async function _getMedia(kind, deviceId) {
    let captureStream = null;
    const constraints =
        (kind === 'video' ?
            { video: { deviceId } } :
            { audio: { deviceId } });
    try {
        captureStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        console.error("Error: " + err);
    }

    return captureStream;
}

async function _getShareScreen() {
    let captureStream = null;

    try {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
    } catch (err) {
        console.error("Error: " + err);
    }
    return captureStream;
}

async function gotDevices() {
    let deviceInfos;
    try {
        const tmpTrack = await _getMedia("audio", null).getTracks()[0];

        deviceInfos = await navigator.mediaDevices.enumerateDevices();
        
        tmpTrack.stop();
    } catch (err) {
        console.error("Error: " + err);
    }
    console.log("gotDevices: " + JSON.stringify(deviceInfos));

    GlobalUnityInstance.SendMessage('JSReceiver', 'JSOnGetDeviceInfo', JSON.stringify(deviceInfos));
}
