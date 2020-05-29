"use strict";

var myUsername = null;
var partnerUsername = null;     // To store username of other peer
var myPeerConnection = null;    // RTCPeerConnection
var connection = null;
var datachannel = null;

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
        addUser(msg.user_name);
        break;

      case "success":
        console.log(msg.message);
        break;

      case "del-user":
        if(partnerUsername == msg.user_name)
        {
          partnerUsername = null;
          myPeerConnection = null;
          closeGameSession;
        }
        var id = "user_"+msg.user_name;
        var item = document.querySelector("#"+id);
        item.remove();

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
  myPeerConnection.addEventListener('datachannel', event => {
    dataChannel = event.channel;
  });
}


async function handleNegotiationNeededEvent() {
  log("*** Negotiation needed");

  try {
    log("---> Creating offer");
    const offer = await myPeerConnection.createOffer();

    if (myPeerConnection.signalingState != "stable") {
      log("     -- The connection isn't stable yet; postponing...")
      return;
    }

    log("---> Setting local description to the offer");
    await myPeerConnection.setLocalDescription(offer);
.
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

function handleICEConnectionStateChangeEvent(event) {
  log("*** ICE connection state changed to " + myPeerConnection.iceConnectionState);

  switch(myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    case "disconnected":
      closeGameSession();
      break;
  }
}

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

function handleICEGatheringStateChangeEvent(event) {
  log("*** ICE gathering state changed to: " + myPeerConnection.iceGatheringState);
}


function addUser(user_name) {
  var i;
  var listElem = document.querySelector(".userlistbox");
  var item = document.createElement("li");
  item.id = "user_"+user_name;
  item.appendChild(document.createTextNode(user_name));
  item.addEventListener("click", invite, false);
  listElem.appendChild(item);
}


function closeGameSession() {
  document.getElementById("text").disabled = true;
  document.getElementById("send").disabled = true;

  log("Closing the call");

  if (myPeerConnection) {
    log("--> Closing the peer connection");

    myPeerConnection.onnicecandidate = null;
    myPeerConnection.oniceconnectionstatechange = null;
    myPeerConnection.onsignalingstatechange = null;
    myPeerConnection.onicegatheringstatechange = null;
    myPeerConnection.onnotificationneeded = null;

    myPeerConnection.close();
    myPeerConnection = null;
  }

}

async function invite(evt) {
  log("Starting to prepare an invitation");
  if (myPeerConnection) {
    alert("You can't start a new game session because you already have one open!");
  } 
  else 
  {
    var clickedUsername = evt.target.textContent;

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

  log("Received game offer from " + partnerUsername);
  if (!myPeerConnection) {
    createPeerConnection();
  }

  var desc = new RTCSessionDescription(msg.sdp);

  if (myPeerConnection.signalingState != "stable") {
    log("  - But the signaling state isn't stable, so triggering rollback");

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

async function handleGameAnswerMsg(msg) {
  log("*** Call recipient has accepted our call");

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