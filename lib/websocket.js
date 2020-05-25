'use strict';

const WebSocket = require('ws');

const redis = require('redis');

module.exports = (server) => {

  let wss;

  try {

    wss = new WebSocket.Server({ server: server });

  } catch (e){

    console.log(e);

    return;

  }

  let user_set = new Set();

  let user_socket_mapping = new Map();

  let user_user_mapping = new Map();

  wss.on('connection', async(ws, req) => {

    let message;
    let user_name = req.session.user_name;
    let partner_name;
    let partner_ws;

    console.log(process.pid,'new user connected , ', user_name);

    wss.clients.forEach(function each(client) {
      message = JSON.stringify({"type":"new-user", "user_name":user_name});

      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    user_socket_mapping.set(user_name, ws);

    ws.on('close', async() => {

      if(partner_ws!=='undefined')
      {
        message = {"type": "partner-exit"}
        partner_user.send(JSON.stringify(message));
      }
    });

    ws.on('message', (msg) => {

      message = JSON.parse(msg);

      if(message.type == 'register-user')
      {
        if(user_set.has(message.user_name))
        {
          message = {"type":"error", "message": "username already taken"};
          ws.send(JSON.stringify(message));
        }
        else
        {
          user_set.add(message.user_name)
          user_socket_mapping.set(message.user_name,ws);
          message = {"type":"success", "message": "username successfully added"};
          ws.send(JSON.stringify(message));
        }
      }

      else if(message.type == 'add-partner');
      {
        if(user_name==='undefined')
        {
          message = {"type":"error", "message":"user name not defined"};
          ws.send(JSON.stringify(message));
        }
        else
        {
          user_user_mapping.set(user_name,message.partner_name);
          user_user_mapping.set(message.partner_name,user_name);

          let partner_ws = user_socket_mapping.get(message.partner_name);
          message = {"type": "partner-add", "partner-name": user_name};
          partner_ws.send(JSON.stringify(message));
        }

      }
      else
      {
        partner_ws.send(msg);
      }
    });
  });

  return wss;
};

