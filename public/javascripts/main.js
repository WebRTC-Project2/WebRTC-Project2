'use strict';

const $self = {
  rtcConfig: null,
  constraints: { audio: true, video: true},

};

const $peers = {
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  $self.stream = await navigator.mediaDevices
    .getUserMedia(constraints);
  displayStream('#self', $self.stream);
}


/**
* Socket Server Events and Callbacks
*/
const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false });

registerScEvents();


/* DOM Elements */



const button = document
  .querySelector('#call-button');

const selfVideo = document
  .querySelector('#self');

button.addEventListener('click', handleButton);


const chatForm = document
.querySelector('#chat-form');

chatForm.addEventListener('submit',
 chatFormFun);

 const vidButton = document
   .querySelector('#video-button');

vidButton.addEventListener('click',
 stopVid);


const audbutton = document
   .querySelector('#audio-button');

audbutton.addEventListener('click',
 stopAud);

/* User-Media/DOM */
function displayStream(selector, stream) {
  const video = document.querySelector(selector);
  video.srcObject = stream;
}


/* DOM Events */
//function for Audio on and off button
function stopAud(e){

  const audSt = $self.stream.getAudioTracks()[0];
  const audbutton = e.target;
  if (audbutton.className === 'audiocut') {
    audbutton.className = 'mute';
    audbutton.innerText = 'UnMute';
    audSt.enabled = false;
    console.log('Audio Stopped');
  } else {
    audbutton.className = 'audiocut';
    audbutton.innerText = 'Mute';
    audSt.enabled = true;
    console.log('Audio Started');
  }

}
//function for the vido on and off button
function stopVid(e) {

  const vidSt = $self.stream.getVideoTracks()[0];
  const vidButton = e.target;
  if (vidButton.className === 'videocut') {
    vidButton.className = 'vidOff';
    vidButton.innerText = 'Video ON';
    vidSt.enabled = false;
      console.log('Video Stopped');
  } else {
    vidButton.className = 'videocut';
    vidButton.innerText = 'Video Off';
    vidSt.enabled = true;
      console.log('Video Started');
  }
}

//adding eventlistener with the function in it to pause the video


//function for join and leave call
function handleButton(e) {
  const button = e.target;
  if (button.className === 'join') {
    button.className = 'leave';
    button.innerText = 'Leave Call';
    joinCall();
  } else {
    button.className = 'join';
    button.innerText = 'Join Call';
    leaveCall();
  }
}


// function that joins the call
function joinCall() {
  sc.open();
  registerRtcEvents($peer);
  establishCallFeatures($peer);
}

// function that joins the call

function leaveCall() {
  resetCall($peer)
  sc.close();
}
// function that resets the connection

function resetCall(peer) {
  displayStream('#peer', null);
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);

}
// function that resets the connection and establishes it again

function resetAndConnectAgain(peer) {
  resetCall(peer);
  $self.isMakingOffer = false;
  $self.isIgnoringOffer = false;
  $self.isSettingRemoteAnswerPending = false;
  $self.isSuppressingInitialOffer = $self.isPolite;
  registerScEvents(peer);
  establishCallFeatures(peer);

  if ($self.isPolite){
    sc.emit('signal',
      {description:
        {type: '_reset'}
      });
  }

}
// function to handle chat messages
function chatFormFun(e) {
  e.preventDefault();

  const form = e.target;
  const userInput = document.querySelector('#chat-msg');
  const message = userInput.value;

  appendMessage('self', message);

  $peer.chatChannel.send(message);

  console.log ('customer message ', message);
  userInput.value = '';

}
//function to show messages
function appendMessage (sender, message){
  const log = document.querySelector('#chat-log');
  const li = document.createElement('li');
  li.innerText = message;
  li.className = sender;
  log.appendChild(li);

}




/* WebRTC Events */

//function that handles all the connection
function establishCallFeatures(peer) {
//vdieo track
  peer.connection
    .addTrack($self.stream.getTracks()[0],
      $self.stream);
//audio track
  peer.connection
    .addTrack($self.stream.getTracks()[1],
      $self.stream);

  peer.chatChannel = peer.connection
    .createDataChannel('chat',
      { negotiated: true, id: 25});

  peer.chatChannel.onmessage = function({ data }){
    appendMessage('peer', data);

  }
}

function registerRtcEvents(peer) {
  peer.connection
    .onnegotiationneeded = handleRtcNegotiation;
  peer.connection
    .onicecandidate = handleIceCandidate;
  peer.connection
    .ontrack = handleRtcTrack;
  peer.connection
    .ondatachannel = handleRtcDataChannel;
}

async function handleRtcNegotiation() {
  if ($self.isSuppressingInitialOffer)
  return;
  console.log('RTC negotiation needed...');
  // send an SDP description

  try {
    $self.isMakingOffer = true;
    await $peer.connection.setLocalDescription();//running with the new options
  } catch(e) {
    const request = await $peer.connection.createOffer();// running with the old optinos
    await $peer.connection.setLocalDescription(request);
  } finally {
    sc.emit('signal', { description:
      $peer.connection.localDescription });//deciding and making offer
    $self.isMakingOffer = false;
  }
}
function handleIceCandidate({ candidate }) {
  sc.emit('signal', { candidate:
    candidate });
}
function handleRtcTrack({ track, streams: [stream] }) {
  // attach incoming track to the DOM
  displayStream('#peer', stream);
}

function handleRtcDataChannel({ channel }) {
  const dc = channel;
  console.log('Heard channel', dc.label,
    'with ID', dc.id);
  document.querySelector('#peer')
    .className = dc.label;
  dc.onopen = function() {
    console.log('Now I have heard the channel open');
    dc.close();
  };
}

/* Signaling Channel Events */

function registerScEvents() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('connected peers', handleScConnectedPeers);
  sc.on('signal', handleScSignal);
  sc.on('disconnected peer', handleScDisconnectedPeer)
}

function handleSongReceive(data) {
  console.log("song received");
  if (data.namespace == namespace) {
    showSpotifyPlayer(data.url);
  }
}


function handleScConnect() {
  console.log('Connected to signaling channel!');
  $self.id = sc.id;
  console.log('Self ID:', $self.id);
}

function handleScConnectedPeers(ids) {
  console.log('Heard connected peers event!');
  console.log('Connected peer IDs:', ids.join(', '));
}

function handleScConnectedPeer(id) {
  console.log('Heard connected peer event!');
  console.log('Connected peer ID:', id);
}


function handleScDisconnectedPeer(id) {
  console.log('Heard disconnected peer event!');
  console.log('Disconnected peer ID:', id);

}

async function handleScSignal({ description, candidate }) {
  console.log('Heard signal event!');
  if (description) {
    console.log('Received SDP Signal:', description);

  if (description.type === '_reset'){
    resetAndConnectAgain($peer);
    return;
  }
    const readyForOffer =
        !$self.isMakingOffer &&
        ($peer.connection.signalingState === 'stable'
          || $self.isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    $self.isIgnoringOffer = !$self.isPolite && offerCollision;

    if ($self.isIgnoringOffer) {
      return;
    }

    $self.isSettingRemoteAnswerPending = description.type === 'answer';
    console.log('Incoming info:',
         $peer.connection.signalingState);
       try {
         await $peer.connection.setRemoteDescription(description);
       } catch(e) {

         resetAndConnectAgain($peer);
         return;
       }
    $self.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      try {
        await $peer.connection.setLocalDescription(); // running with new options
      } catch(e){
        const response = await $peer.connection.createResponse();//running with older options
        await $peer.connection.setLocalDescription(response);
      } finally{
        sc.emit('signal',
          { description:
            $peer.connection.localDescription });//desicing and sending description

        $self.isSuppressingInitialOffer = false;
      }
    }
  } else if (candidate) {
    console.log('Received ICE candidate:', candidate);
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch(e) {
      if (!$self.isIgnoringOffer) {
        console.error('Cannot add ICE candidate for peer', e);
      }
    }
  }
}

/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{6}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 8);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}

function showSpotifyPlayer(url) {
  let node = document.getElementById("spotify-iframe");
  node.innerHTML = `<iframe src="${url}" id="spotify-player" style="width:100%;bottom:0;" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
}
function uploadSpotifyUrl() {
  let song_url = document.getElementById("song-url").value;
  if (!song_url.includes("https://open.spotify.com/")) {
    alert("not a valid spotify embed url");
    return false;
  }
  song_url=song_url.replace(".com/",".com/embed/");
  showSpotifyPlayer(song_url);
  if (sc.connected) {
    console.log("sending the song url");
    sc.emit('uploadsong',
      {
        url: song_url,
        namespace: namespace
      });
  }
  return false;
}
