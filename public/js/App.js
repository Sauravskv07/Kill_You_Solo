"use strict";

var myUsername = null;
var partnerUsername = null;     // To store username of other peer
var myPeerConnection = null;    // RTCPeerConnection
var connection = null;

function log(text) {
  var time = new Date();

  console.log("[" + time.toLocaleTimeString() + "] " + text);
}

function log_error(text) {
  var time = new Date();

  console.trace("[" + time.toLocaleTimeString() + "] " + text);
}

function sendToServer(msg) {
  var msgJSON = JSON.stringify(msg);

  log("Sending '" + msg.type + "' message: " + msgJSON);
  
  connection.send(msgJSON);

}



/*
function handleSendButton() {
  var msg = {
    text: document.getElementById("text").value,
    type: "message",
    date: Date.now()
  };
  //send via webrtc
  document.getElementById("text").value = "";
}

function handleKey(evt) {
  if (evt.keyCode === 13 || evt.keyCode === 14) {
    if (!document.getElementById("send").disabled) {
      handleSendButton();
    }
  }
}




    var chatBox = document.querySelector(".chatbox");
    
    var text = "";

    if (text.length) {
      chatBox.innerHTML += text;
      chatBox.scrollTop = chatBox.scrollHeight - chatBox.clientHeight;
    }
*/


function connect() {
  var serverUrl;
  var scheme = "ws";

  if (document.location.protocol === "https:") {
    scheme += "s";
  }


  serverUrl = scheme + "://" + window.location.hostname + ":8443";

  log(`Connecting to server: ${serverUrl}`);
  
  connection = new WebSocket(serverUrl, "json");


  let pendingReconnect = false;

  function clearPendingReconnect(){
    if (pendingReconnect) {
      clearTimeout(pendingReconnect)
      pendingReconnect = null
    }  
  }

  let ononline = function(event) {

    if (reconnectWhenOnlineAgain) {
      clearPendingReconnect();
      reconnect(event);
    }

  },

  onoffline = function() {
    reconnectWhenOnlineAgain = true
    connection.close(1000)
  };


  function reconnect(event) {
    if (navigator.onLine === false) {
      reconnectWhenOnlineAgain = true
      return
    }
    
    var delay = 1000;
    
    if (typeof delay === 'number') {
      pendingReconnect = setTimeout(()=>{
        connection = WebSocket('wss://localhost:8443');
      }, delay);
    }
  }


  global.addEventListener('online', ononline)
  global.addEventListener('offline', onoffline)


  connection.onopen = () => {
    console.log('connected');
    document.getElementById("text").disabled = false;
    document.getElementById("send").disabled = false;
  };

  connection.onclose = () => {
    console.error('disconnected');
  }; 

  connection.onerror = function(evt) {
    console.dir(evt);
  }

  connection.onmessage = function(evt) {
    
    var msg = JSON.parse(evt.data);
    
    log("Message received: ");
    console.dir(msg);
    var time = new Date(msg.date);
    var timeStr = time.toLocaleTimeString();

    switch(msg.type) {
      case "error":
        console.log(msg.message);
        break;

      case "new-user":
        //add new user to user list;
        break;

      case "success":
        console.log(msg.message);
        break;

      case "del-user":
        if(partnerUsername == msg.user_name)
        {
          partnerUsername = null;
          myPeerConnection = null;
          //dataChannel also null
          //remove all listeners;
        }
        //remove user from user list.


      case "game-offer": 
        handleGameOfferMsg(msg);
        break;

      case "game-answer":  
        handleGameAnswerMsg(msg);
        break;

      case "new-ice-candidate": 
        handleNewICECandidateMsg(msg);
        break;

      default:
        log_error("Unknown message received:");
        log_error(msg);
    }

  };
}


async function createPeerConnection() {
  
  log("Setting up a connection...");

  // Create an RTCPeerConnection which knows to use our chosen
  // STUN server.

  myPeerConnection = new RTCPeerConnection({
    iceServers: [     
      {
        urls: "stun.l.google.com:19302"
      },
      {
        urls: "stun1.l.google.com:19302"
      },
      {
        urls: "stun2.l.google.com:19302"
      },
      {
        urls: "stun3.l.google.com:19302"
      },
      {
        urls: "stun4.l.google.com:19302"
      }
    ]
  });

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
  myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
  myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  
  //need to verify
  myPeerConnection.addEventListener('datachannel', event => {
    const dataChannel = event.channel;
  });
}

// Called by the WebRTC layer to let us know when it's time to
// begin, resume, or restart ICE negotiation.

async function handleNegotiationNeededEvent() {
  log("*** Negotiation needed");

  try {
    log("---> Creating offer");
    const offer = await myPeerConnection.createOffer();

    // If the connection hasn't yet achieved the "stable" state,
    // return to the caller. Another negotiationneeded event
    // will be fired when the state stabilizes.

    if (myPeerConnection.signalingState != "stable") {
      log("     -- The connection isn't stable yet; postponing...")
      return;
    }

    // Establish the offer as the local peer's current
    // description.

    log("---> Setting local description to the offer");
    await myPeerConnection.setLocalDescription(offer);

    // Send the offer to the remote peer.

    log("---> Sending the offer to the remote peer");
    sendToServer({
      name: myUsername,
      target: partnerUsername,
      type: "game-offer",
      sdp: myPeerConnection.localDescription
    });
  } catch(err) {
    log("*** The following error occurred while handling the negotiationneeded event:");
    reportError(err);
  };
}


// Handles |icecandidate| events by forwarding the specified
// ICE candidate (created by our local ICE agent) to the other
// peer through the signaling server.

function handleICECandidateEvent(event) {
  if (event.candidate) {
    log("*** Outgoing ICE candidate: " + event.candidate.candidate);

    sendToServer({
      type: "new-ice-candidate",
      target: targetUsername,
      candidate: event.candidate
    });
  }
}

// Handle |iceconnectionstatechange| events. This will detect
// when the ICE connection is closed, failed, or disconnected.
//
// This is called when the state of the ICE agent changes.

function handleICEConnectionStateChangeEvent(event) {
  log("*** ICE connection state changed to " + myPeerConnection.iceConnectionState);

  switch(myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    case "disconnected":
      closeVideoCall();
      break;
  }
}

// Set up a |signalingstatechange| event handler. This will detect when
// the signaling connection is closed.
//
// NOTE: This will actually move to the new RTCPeerConnectionState enum
// returned in the property RTCPeerConnection.connectionState when
// browsers catch up with the latest version of the specification!

function handleSignalingStateChangeEvent(event) {
  log("*** WebRTC signaling state changed to: " + myPeerConnection.signalingState);
  switch(myPeerConnection.signalingState) {
    case "closed":
      closeGameSession();
      break;
  }
}

// Handle the |icegatheringstatechange| event. This lets us know what the
// ICE engine is currently working on: "new" means no networking has happened
// yet, "gathering" means the ICE engine is currently gathering candidates,
// and "complete" means gathering is complete. Note that the engine can
// alternate between "gathering" and "complete" repeatedly as needs and
// circumstances change.
//
// We don't need to do anything when this happens, but we log it to the
// console so you can see what's going on when playing with the sample.

function handleICEGatheringStateChangeEvent(event) {
  log("*** ICE gathering state changed to: " + myPeerConnection.iceGatheringState);
}


function addUser(user_name) {
  var i;
  var listElem = document.querySelector(".userlistbox");
  var item = document.createElement("li");
  item.appendChild(document.createTextNode(user_name));
  item.addEventListener("click", invite, false);
  listElem.appendChild(item);
}

// Close the RTCPeerConnection and reset variables so that the user can
// make or receive another call if they wish. This is called both
// when the user hangs up, the other user hangs up, or if a connection
// failure is detected.

function closeGameSession() {
  document.getElementById("text").disabled = true;
  document.getElementById("send").disabled = true;

  log("Closing the call");

  // Close the RTCPeerConnection

  if (myPeerConnection) {
    log("--> Closing the peer connection");

    myPeerConnection.onnicecandidate = null;
    myPeerConnection.oniceconnectionstatechange = null;
    myPeerConnection.onsignalingstatechange = null;
    myPeerConnection.onicegatheringstatechange = null;
    myPeerConnection.onnotificationneeded = null;

    // Close the peer connection

    myPeerConnection.close();
    myPeerConnection = null;
  }

}

// Handle a click on an item in the user list by inviting the clicked
// user to video chat. Note that we don't actually send a message to
// the callee here -- calling RTCPeerConnection.addTrack() issues
// a |notificationneeded| event, so we'll let our handler for that
// make the offer.

async function invite(evt) {
  log("Starting to prepare an invitation");
  if (myPeerConnection) {
    alert("You can't start a new game session because you already have one open!");
  } 
  else 
  {
    var clickedUsername = evt.target.textContent;

    // Don't allow users to call themselves, because weird.

    if (clickedUsername === myUsername) {
      alert("I'm afraid I can't let you play game with yourself. That would be weird.");
      return;
    }
    
    partnerUsername = clickedUsername;

    log("Inviting user " + clickedUsername);

    log("Setting up connection to invite user: " + targetUsername);

    createPeerConnection();

    const dataChannel = myPeerConnection.createDataChannel();

  }
}


async function handleGameOfferMsg(msg) {
  
  partnerUsername = msg.name;

  // If we're not already connected, create an RTCPeerConnection
  // to be linked to the caller.

  log("Received video chat offer from " + partnerUsername);
  if (!myPeerConnection) {
    createPeerConnection();
  }

  // We need to set the remote description to the received SDP offer
  // so that our local WebRTC layer knows how to talk to the caller.

  var desc = new RTCSessionDescription(msg.sdp);

  // If the connection isn't stable yet, wait for it...

  if (myPeerConnection.signalingState != "stable") {
    log("  - But the signaling state isn't stable, so triggering rollback");

    // Set the local and remove descriptions for rollback; don't proceed
    // until both return.
    await Promise.all([
      myPeerConnection.setLocalDescription({type: "rollback"}),
      myPeerConnection.setRemoteDescription(desc)
    ]);
    return;
  } else {
    log ("  - Setting remote description");
    await myPeerConnection.setRemoteDescription(desc);
  }


  log("---> Creating and sending answer to partner");

  await myPeerConnection.setLocalDescription(await myPeerConnection.createAnswer());

  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "game-answer",
    sdp: myPeerConnection.localDescription
  });
}

// Responds to the "video-answer" message sent to the caller
// once the callee has decided to accept our request to talk.

async function handleGameAnswerMsg(msg) {
  log("*** Call recipient has accepted our call");

  // Configure the remote description, which is the SDP payload
  // in our "video-answer" message.

  var desc = new RTCSessionDescription(msg.sdp);
  await myPeerConnection.setRemoteDescription(desc).catch(reportError);
}

// A new ICE candidate has been received from the other peer. Call
// RTCPeerConnection.addIceCandidate() to send it along to the
// local ICE framework.

async function handleNewICECandidateMsg(msg) {
  var candidate = new RTCIceCandidate(msg.candidate);

  log("*** Adding received ICE candidate: " + JSON.stringify(candidate));
  try {
    await myPeerConnection.addIceCandidate(candidate)
  } catch(err) {
    reportError(err);
  }
}

function reportError(errMessage) {
  log_error(`Error ${errMessage.name}: ${errMessage.message}`);
}