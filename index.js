// Server for TicTacToe
import express from 'express';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import {f,b,s} from '../../_lib/colors.js';
import path from 'path';
const app = express();
const port = 4001;
const __dirname = path.resolve();
app.use(
	express.urlencoded({
		extended: true
	})
);
app.use(express.json()); // Being able to see request body
app.use(cookieParser()); // Manipulate cookies

app.listen(port,()=>{ // Starting server
	console.log(`${f.lblue}Server running on ${f.reset}localhost:${port+f.lblue}!`);
});

//=================================================
// LIB FUNCTIONS
//=================================================
/**
 * Create template of Express response
 * @param {Response} resObj Object of `express` Response
 * @param {Array<Array<String>>} headers Headers to add. Example: [["Content-Type","text/html"],["Referer","/"]]
 * @param {Int} code HTTP Status Code
 */
var genResponse = (resObj,headers = [],code = 200)=>{
	for(let header of headers) {
		resObj.set(header[0],header[1]);
	}
	resObj.status(code);
};
/**
 * Generates string with random letters
 * @param {Int} len Length of resulting string
 * @param {String} dictionary Character pool for generated string.
 * @returns {String} Generated string
 */
var gibberish = (len,dictionary='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')=>{
	let str = "";
	for(let i=0;i<len;i++) {
		str+=dictionary[Math.floor(Math.random()*dictionary.length)];
	}
	return str;
};
//=================================================
// GAME FUNCTIONS
//=================================================
var checkAuth = token=>{
	// Decode token
	let decoded = Buffer.from(token,'base64').toString();
	// Find player by name
	for(let plr of playerDatabase) {
		for(let tkn of plr.authTokens) {
			let tknDecoded = Buffer.from(tkn.value,'base64').toString();
			if(tknDecoded==decoded) {
				return true;
			}
		}
	}
	return false;
};
var getPlayer = token => {
	// Decode token
	let decoded = Buffer.from(token,'base64').toString();
	// Find player by name
	for(let plr of playerDatabase) {
		for(let tkn of plr.authTokens) {
			let tknDecoded = Buffer.from(tkn.value,'base64').toString();
			if(tknDecoded==decoded) {
				return plr;
			}
		}
	}
	return null;
};
//=================================================
// GAME CLASSES
//=================================================
class Lobby { // Lobby of game
	constructor(name,visible = true,host = null) {
		this.name = name;
		this.id = lobbyIncrement;
		this.gameBoard = null; // new Board();
		this.inviteCode = gibberish(6);
		this.visible = visible; // false - private (not visible, access only after inputting invite code)
		this.host = host;
		this.guest = null;
		this.boardSetting = "3x3"; // Available (not now, but soon): 4x4, 5x5
		this.gameStatus = 'open'; // full, started
		this.rounds = 1; // Can play more rounds
		this.currentRound = 0;
		this.points = [0,0]; // [0,4]
		this.chatHistory = [];
		this.chatIncrement = 0;
		Lobby.checkInviteCodes(lobbies);
	}
	makeGuestHost() {
		this.host = this.guest;
		this.guest = null;
	}
	removeGuest() {
		this.guest = null;
	}
	static checkInviteCodes(lobbyDatabase) {
		let invCodeCol = new Set();
		for(let i in lobbyDatabase) {
			let lb=lobbyDatabase[i];
			if(invCodeCol.has(lb.inviteCode)) { // Code exists, regen invite code
				lb.inviteCode = gibberish(6);
				i=0; continue;
			}
			invCodeCol.add(lb.inviteCode);
		}
	}
	getChat() {
		return this.chatHistory;
	}
	newMsg (author,text) {
		this.chatHistory.push(new ChatEntry(author.getID(),text,this.chatIncrement++));
	}
	initBoard() {
		if(this.currentRound >= this.rounds) { // Maximum points are reached, cancel match
			this.gameStatus = 'full';
			let p;
			let g;
			for(let plr of playerDatabase) {
				if(plr.name==this.host.name) p = plr;
				if(plr.name==this.guest.name) g = plr;
			}
			p.action = 'room';
			g.action = 'room';
			let winnerName = "";
			if(this.points[0]>this.points[1]) winnerName = p.name+" as a winner";
			else if(this.points[0]<this.points[1]) winnerName = p.g.name+" as a winner";
			else winnerName = "draw";
			this.chatHistory.push(new ChatEntry(playerDatabase[0],"Match has ended with "+winnerName+" ("+this.points.join(" : ")+")",++this.chatIncrement));
			this.gameBoard = null;
			this.currentRound = 0;
			this.points = [0,0];
			return;
		}
		this.gameBoard = new Board(3,3,this.host,this.guest);
		this.gameStatus = 'game';
	}
} 
class ChatEntry {
	constructor(author,content,id) {
		this.id = id;
		this.author = author;
		this.content = content;
		this.timeStamp = new Date(Date.now());
	}
	edit(newContent) {
		this.content = newContent;
	}
	remove() {
		this.content = "<i> Comment removed by administrator </i>";
	}
}
class Board { // Game board
	constructor(x,y,playerA,playerB) {
		this.cells = [];
		this.turn = true; //X - true, O - false
		this.x = null; // player for x
		this.o = null;
		this.winner = undefined;
		let judgement = Math.round(Math.random());
		if(judgement == 1) {
			this.x = playerA;
			this.o = playerB;
		}
		else {
			this.o = playerA;
			this.x = playerB;
		}
		for(let i=0;i<y;i++) {
			let row = [];
			for(let i=0;i<x;i++) {
				row.push(new CheckmarkBox(i));
			}
			this.cells.push(row);
		}
	}
	getBox(x=0,y=0) {
		if(x>this.cells[0].length||y>this.cells.length||x<0||y<0) return false;
		return this.cells[x][y];
	}
	checkMatches() {
		/**
		 *     Y
		 *  0  1  2
		 * [ ][ ][ ] 0
		 * [ ][ ][ ] 1 X
 		 * [ ][ ][ ] 2
		 */
		// TODO
		if(this.cells[0].length==3) { // 3x3 board
			if(
				// horizontal checking X
				(this.cells[0][0].ox==this.cells[0][1].ox&&this.cells[0][0].ox==this.cells[0][2].ox&&this.cells[0][0].ox==true)||
				(this.cells[1][0].ox==this.cells[1][1].ox&&this.cells[1][0].ox==this.cells[1][2].ox&&this.cells[1][0].ox==true)||
				(this.cells[2][0].ox==this.cells[2][1].ox&&this.cells[2][0].ox==this.cells[2][2].ox&&this.cells[2][0].ox==true)
			) {
				this.winner = true;
				return true;
			}
			else if(
				// horizontal checking O
				(this.cells[0][0].ox==this.cells[0][1].ox&&this.cells[0][0].ox==this.cells[0][2].ox&&this.cells[0][0].ox==false)||
				(this.cells[1][0].ox==this.cells[1][1].ox&&this.cells[1][0].ox==this.cells[1][2].ox&&this.cells[1][0].ox==false)||
				(this.cells[2][0].ox==this.cells[2][1].ox&&this.cells[2][0].ox==this.cells[2][2].ox&&this.cells[2][0].ox==false)
			) {
				this.winner = false;
				return true;
			}
			else if(
				// vertical checking X
				(this.cells[0][0].ox==this.cells[1][0].ox&&this.cells[0][0].ox==this.cells[2][0].ox&&this.cells[2][0].ox==true)||
				(this.cells[0][1].ox==this.cells[1][1].ox&&this.cells[0][1].ox==this.cells[2][1].ox&&this.cells[2][1].ox==true)||
				(this.cells[0][2].ox==this.cells[1][2].ox&&this.cells[0][2].ox==this.cells[2][2].ox&&this.cells[2][2].ox==true)
			) {
				this.winner = true;
				return true;
			}
			else if(
				// vertical checking O
				(this.cells[0][0].ox==this.cells[1][0].ox&&this.cells[0][0].ox==this.cells[2][0].ox&&this.cells[2][0].ox==false)||
				(this.cells[0][1].ox==this.cells[1][1].ox&&this.cells[0][1].ox==this.cells[2][1].ox&&this.cells[2][1].ox==false)||
				(this.cells[0][2].ox==this.cells[1][2].ox&&this.cells[0][2].ox==this.cells[2][2].ox&&this.cells[2][2].ox==false)
			) {
				this.winner = false;
				return true;
			}
			else if(
				// cross checking X
				(this.cells[0][0].ox==this.cells[1][1].ox&&this.cells[0][0].ox==this.cells[2][2].ox&&this.cells[2][2].ox==true)||
				(this.cells[2][0].ox==this.cells[1][1].ox&&this.cells[2][0].ox==this.cells[0][2].ox&&this.cells[0][2].ox==true)
			) {
				this.winner = true;
				return true;
			}
			else if(
				// cross checking O
				(this.cells[0][0].ox==this.cells[1][1].ox&&this.cells[0][0].ox==this.cells[2][2].ox&&this.cells[2][2].ox==false)||
				(this.cells[2][0].ox==this.cells[1][1].ox&&this.cells[2][0].ox==this.cells[0][2].ox&&this.cells[0][2].ox==false)
			) {
				this.winner = false;
				return true;
			}
		}
		else if(this.cells[1].length==4) { // 4x4 board

		}
		else {

		}

	}
	boardFull() {
		let result = true;
		for(let r of this.cells) {
			for(let c of r) {
				if(c.ox==null) result = false;
			}
		}
		return result;
	}
	isTurn(player) {
		if(this.turn==false&&this.o.name==player.name) return true; // If is O's turn, and players has the same name
		if(this.turn==true&&this.x.name == player.name) return true;
		return false;
	}
}
class CheckmarkBox { // Single tile of the board
	constructor(id) {
		this.ox = null; // null, true (X), false (O)
		this.id = id;
	}
}
class Player {
	constructor(name,pass) {
		this.name = name;
		this.pass = pass;
		this.id = playerIncrement;
		this.authTokens = [];
		this.action = 'lobby'; // 'offline' - is not connected, 'lobby' - sitting in lobby, 'room' - is in room, 'playing' - is playing
		this.lobbyJoined = null; // ID of lobby joined
	}
	authenticate(input) {
		if(this.pass == input) return true;
		return false;
	}
	genAuthToken() {
		let newTkn = new AuthToken(this.name);
		for(let i in this.authTokens) {
			if(this.authTokens[i].value == newTkn.value) { // Value repeats, regenerate token
				newTkn = new AuthToken(this.name);
				i=0;
			}
		}
		if(this.authTokens.length>=10) { // too much auth tokens, security risk
			// just truncate them to last 10
			this.authTokens.splice(9,this.authTokens.length-1);
		}
		this.authTokens.push(newTkn);
	}
	getID() {
		return new PlayerID(this.name,this.id);
	}
	getToken (token) {
		for (let tkn of this.authTokens) {
			if(token == tkn.value) return tkn;
		}
		return null;
	}
}
class PlayerID {
	constructor(name,id) {
		this.name = name;
		this.id = id;
	}
}
class AuthToken {
	constructor(name,maxAge=600000) {
		this.expires = new Date(Date.now()+maxAge);
		let encodedToken = Buffer.from(name+","+gibberish(40)).toString('base64');
		this.value = encodedToken;
	}
	extend(newAge=600000) {
		this.expires = new Date(Date.now()+newAge);
	}
}
//=================================================
// GAME VARS
//=================================================
var lobbies = []; // Main lobby database
var playerDatabase = [new Player("<b style='color: red'>SYSTEM</b>","XSW@1qaz")]; // Main player database

var playerIncrement = 0;
var lobbyIncrement = 0;

var httpResponses = {
	registerSuccess:			[1000,"Register successful"],
	registerInvalidSyntax:		[1001,"Cannot register: Invalid request"],
	registerUserExists:			[1002,"Cannot register: User exists"],
	registerUnsafePassword:		[1003,"Cannot register: Password is unsafe"],
	registerAlreadyLoggedIn:	[1004,"Cannot register: Already logged in. Logout first!"],
	registerUnsafeName:			[1005,"Cannot register: Name is invalid"],

	loginSuccess:				[1100,"Login successful"],
	loginInvalidSyntax:			[1101,"Cannot login: Invalid request"],
	loginBadCredentials:		[1102,"Cannot login: Invalid username or password"],
	loginAlreadyLoggedIn:		[1103,"Cannot login: Already logged in. Logout first!"],
	logoffSuccess:				[1104,"Logoff successful"],

	lobbyCreateSuccess:			[1200,"Lobby creation successfull"],
	lobbyCreateSyntax:			[1201,"Cannot create lobby: Invalid request"],
	lobbyCreateUnauthorized:	[1202,"Cannot create lobby: User is unauthorized"],
	lobbyCreateNameInUse:		[1203,"Cannot create lobby: Lobby name is already taken"],
	lobbyCreateInvalidName:		[1204,"Cannot create lobby: Lobby name is invalid"],
	lobbyCreateInvalidAction:	[1205,"Cannot create lobby: User's action is forbidden"],
	
	lobbyJoinSuccess:			[1300,"Lobby join successful"],
	lobbyJoinSyntax:			[1301,"Cannot join lobby: Invalid request"],
	lobbyJoinUnauthorized:		[1302,"Cannot join lobby: User is unauthenticated"],
	lobbyJoinInvalidCode:		[1303,"Cannot join lobby: Code is invalid"],
	lobbyJoinRoomFull:			[1304,"Cannot join lobby: Room is full"],

	lobbyInfoSuccess:			[1400,"Lobby info accessed"],
	lobbyInfoSyntax:			[1401,"Cannot fetch lobby info: Invalid request"],
	lobbyInfoUnauthorized:		[1402,"Cannot fetch lobby info: User is not authenticated"],
	lobbyInfoNotInLobby:		[1403,"Cannot fetch lobby info: User is not in the room"],

	lobbyLeaveSuccess:			[1500,"Lobby leave successfull"],
	lobbyLeaveSyntax:			[1501,"Cannot leave lobby: Invalid request"],
	lobbyLeaveUnauthorized:		[1502,"Cannot leave lobby: User is not authorized"],
	lobbyLeaveNotInLobby:		[1503,"Cannot leave lobby: User is not in the room"],

	lobbyUpdateSuccess:			[1600,"Lobby update successful"],
	lobbyUpdateSyntax: 			[1601,"Cannot update lobby: Invalid request"],
	lobbyUpdateUnauthorized: 	[1602,"Cannot update lobby: User is unauthorized"],
	lobbyUpdateNotInLobby:		[1603,"Cannot update lobby: User is not in the room"],
	lobbyUpdateInvalidOptions:	[1604,"Cannot update lobby: Options are invalid"],

	lobbyKickSuccess:			[1700,"Guest kick successful"],
	lobbyKickNotInLobby:		[1701,"Cannot kick guest: User is not in the room"],
	lobbyKickUnauthorized:		[1702,"Cannot kick guest: User is unauthorized"],
	lobbyKickNoGuest:			[1703,"Cannot kick guest: No guest present"],

	lobbyChatSuccess:			[1800,"Chat fetching successful"],
	lobbyChatNotInLobby:		[1801,"Cannot fetch chat: User is not in the room"],
	lobbyChatUnauthorized:		[1802,"Cannot fetch chat: User is unauthorized"],

	lobbyChatSendSuccess:		[1900,"Message send successful"],
	lobbyChatSendNotInLobby:	[1901,"Cannot send message: User is not in the room"],
	lobbyChatSendUnauthorized:	[1902,"Cannot send message: User is unauthorized"],
	lobbyChatSendUnsafe:		[1903,"Cannot send message: Text is invalid"],

	lobbyStartSuccess:			[2000,"Game start successful"],
	lobbyStartUnauthorized:		[2001,"Cannot start game: User is unauthorized"],
	lobbyStartNotInLobby:		[2002,"Cannot start game: User is not in the room"],
	lobbyStartNoGuest:			[2003,"Cannot start game: No guest present"],

	gameDataSuccess:			[2100,"Game data fetch successful"],
	gameDataSyntax:				[2101,"Cannot fetch game data: Invalid request"],
	gameDataNotInGame:			[2102,"Cannot fetch game data: User is not in game"],
	gameDataUnauthorized:		[2103,"Cannot fetch game data: User is unauthorized"],
	gameDataOpponentWon:		[2104,"Cannot fetch game data: User's opponent won"],
	gameDataUserWon:			[2105,"Cannot fetch game data: User won"],
	gameDataDraw:				[2106,"Cannot fetch game data: No one won"],
	gameDataNotPlaying:			[2207,"Cannot fetch game data: Somebody won, wait a while"],

	gamePlaceSuccess:			[2200,"Box place success"],
	gamePlaceSyntax:			[2201,"Cannot place box: Invalid request"],
	gamePlaceUnauthorized:		[2202,"Cannot place box: User is unauthorized"],
	gamePlaceNotInGame:			[2203,"Cannot place box: User is not in game"],
	gamePlaceWrongTurn:			[2204,"Cannot place box: It's not user's turn"],
	gamePlaceBoxTaken:			[2205,"Cannot place box: Box is taken"],
	gamePlaceOpponentWon:		[2205,"Cannot place box: User's opponent won"],
	gamePlaceUserWon:			[2206,"Cannot place box: User won"],
	gamePlaceDraw:				[2207,"Cannot place box: No one won"],
	gamePlaceNotPlaying:		[2208,"Cannot place box: Somebody won, wait a while"],
	gamePlaceBoardFull: 		[2209,"Cannot place box: Board is full"],
};

//=================================================

// Create dummy accounts
while(playerIncrement < 20) {
	playerIncrement++;
	let plr = new Player("dummy"+playerIncrement,"zaq1@WSX");
	playerDatabase.push(plr);
	lobbyIncrement++;
	lobbies.push(new Lobby("placeholder"+lobbyIncrement,true,plr.getID()));
}

// Check if auth tokens of users are expired, in that case remove them
let tokenCheckLoop = setInterval(()=>{
	for(let plr of playerDatabase) {
		let newTokens = [];
		for(let tkn of plr.authTokens) {
			if(tkn.expires>Date.now()) newTokens.push(tkn);
		}
		plr.authTokens = newTokens;
	}
},1000);

// WWW
app.get("/",(req,res)=>{ // Main page deciding what page to display when connected to
	if(!req.cookies.token||!checkAuth(req.cookies.token)) { // No login token, send to login page
		genResponse(res,[["Content-Type","text/html"]],200);
		res.sendFile(__dirname+"/www/login.html");
		return;
	}
	let tokenData = getPlayer(req.cookies.token).getToken(req.cookies.token);
	tokenData.extend();
	res.cookie('token',req.cookies.token,{expires: tokenData.expires,httpOnly:true});
	switch(getPlayer(req.cookies.token).action) {
		case 'game': // Was playing
			genResponse(res,[["Content-Type","text/html"]],200);
			res.sendFile(__dirname+"/www/game.html");
			return;
		case 'room': // Was in lobby
			genResponse(res,[["Content-Type","text/html"]],200);
			res.sendFile(__dirname+"/www/room.html");
			return;
	}

	genResponse(res,[["Content-Type","text/html"]],200);
	res.sendFile(__dirname+"/www/lobby.html");
	return;

});
app.get("/www/login.css",(req,res)=>{ // CSS of login.html
	genResponse(res,[["Content-Type","text/css"]],200);
	res.sendFile(__dirname+"/www/login.css");
	return;
});
app.get("/www/lobby.css",(req,res)=>{ // CSS of lobby.html
	genResponse(res,[["Content-Type","text/css"]],200);
	res.sendFile(__dirname+"/www/lobby.css");
	return;
});
app.get("/www/game.css",(req,res)=>{ // CSS of game.html
	genResponse(res,[["Content-Type","text/css"]],200);
	res.sendFile(__dirname+"/www/game.css");
	return;
});
app.get("/www/room.css",(req,res)=>{ // CSS of room.html
	genResponse(res,[["Content-Type","text/css"]],200);
	res.sendFile(__dirname+"/www/room.css");
	return;
});
app.get("/www/main.js",(req,res)=>{ // Main script file
	genResponse(res,[["Content-Type","text/javascript"]],200);
	res.sendFile(__dirname+"/www/main.js");
	return;
});
app.get("/www/game.js",(req,res)=>{ // Game script file
	genResponse(res,[["Content-Type","text/javascript"]],200);
	res.sendFile(__dirname+"/www/game.js");
	return;
});


// LOBBY & ACCOUNT
app.post("/api/account/create",(req,res)=>{ // New account registering
	// Account details will come here through JSON, not form-data
	let body = req.body;
	// Check if fields exist
	if(body.user === undefined||body.user==""||body.pass === undefined||body.pass=="") {
		genResponse(res,[['Content-Type','text/json']],400);
		let rs = {
			code: httpResponses.registerInvalidSyntax[0],
			message: httpResponses.registerInvalidSyntax[1]
		};
		res.send(rs);
		return;
	}
	// Check if name is valid
	let nameRgx = /^[a-zA-Z0-9\!\@\#\$\%\^\&\*\_\-]+$/g;
	if(body.user.length<4||body.user.length>20||!nameRgx.test(body.user)) {
		genResponse(res,[['Content-Type','text/json']],400);
		let rs = {
			code: httpResponses.registerUnsafeName[0],
			message: httpResponses.registerUnsafeName[1],
		};
		res.send(rs);
	}
	// Check if auth exists, and is correct.
	if(req.cookies.token && checkAuth(req.cookies.token)) {
		genResponse(res,[['Content-Type','text/json']],403);
		let rs = {
			code: httpResponses.registerAlreadyLoggedIn[0],
			message: httpResponses.registerAlreadyLoggedIn[1]
		};
	res.send(rs);
	return;
	}
	// Find if user exists
	for(let player of playerDatabase) {
		if(body.user.toLowerCase() == player.name.toLowerCase()) {
			genResponse(res,[['Content-Type','text/json']],403);
			let rs = {
				code: httpResponses.registerUserExists[0],
				message: httpResponses.registerUserExists[1]
			};
			res.send(rs);
			return;
		}
	}
	// Check if password is secure
	let passUCRgx = /[A-Z]+/g.test(body.pass);
	let passNrRgx = /[0-9]+/g.test(body.pass);
	if(body.pass.length<8||!passUCRgx||!passNrRgx) {
		genResponse(res,[['Content-Type','text/json']],403);
		let rs = {
			code: httpResponses.registerUnsafePassword[0],
			message: httpResponses.registerUnsafePassword[1]
		};
		res.send(rs);
		return;
	}
	// Create new user, respond with essential data
	playerIncrement++;
	let newPlayer = new Player(body.user,body.pass);
	newPlayer.genAuthToken();
	playerDatabase.push(newPlayer);
	genResponse(res,[['Content-Type','text/json']],200);
	let rs = {
		code: httpResponses.registerSuccess[0],
		message: httpResponses.registerSuccess[1],
	};
	res.cookie('token',newPlayer.authTokens[newPlayer.authTokens.length-1].value,{maxAge:600000,httpOnly:true});
	res.send(rs);
});
app.post("/api/account/login",(req,res)=>{ // Account log in
	let body = req.body;
	// Check if login and password is set
	if(body.user === undefined||body.user==""||body.pass === undefined||body.pass=="") {
		genResponse(res,[['Content-Type','text/json']],400);
		let rs = {
			code: httpResponses.loginInvalidSyntax[0],
			message: httpResponses.loginInvalidSyntax[1]
		};
		res.send(rs);
		return;
	}
	// Check if auth exists, and is correct.
	if(req.cookies.token && checkAuth(req.cookies.token)) {
		genResponse(res,[['Content-Type','text/json']],403);
		let rs = {
			code: httpResponses.loginAlreadyLoggedIn[0],
			message: httpResponses.loginAlreadyLoggedIn[1]
		};
	res.send(rs);
	return;
	}
	// Find if user exists, and compare password
	for(let i in playerDatabase) {
		if(body.user.toLowerCase() == playerDatabase[i].name.toLowerCase()&&playerDatabase[i].authenticate(body.pass)) {
			genResponse(res,[['Content-Type','text/json']],200);
			let rs = {
				code: httpResponses.loginSuccess[0],
				message: httpResponses.loginSuccess[1]
			};
			playerDatabase[i].genAuthToken();
			res.cookie('token',playerDatabase[i].authTokens[playerDatabase[i].authTokens.length-1].value,{maxAge:600000,httpOnly:true});
			res.send(rs);
			return;
		}
	}
	genResponse(res,[['Content-Type','text/json']],403);
	let rs = {
		code: httpResponses.loginBadCredentials[0],
		message: httpResponses.loginBadCredentials[1]
	};
	res.send(rs);
	return;
});
app.get("/api/account/logoff",(req,res)=>{ // Account logging off
	genResponse(res,[['Content-Type','text/json']],200);
	let rs = {
		code: httpResponses.logoffSuccess[0],
		message: httpResponses.logoffSuccess[1]
	};
	res.clearCookie('token');
	res.send(rs);
	return;
});
app.get("/api/lobby/list",(req,res)=>{ // List lobby
	let list = [];
	for(let lobby of lobbies) {
		let lobbyObj = {
			name: lobby.name,
			id: lobby.id,
			host: lobby.host,
			inviteCode: lobby.inviteCode,
			guest: lobby.guest ? lobby.guest : null, 
			setting: lobby.boardSetting,
			status: lobby.gameStatus,
			roundsTotal: lobby.rounds,
			roundsPlayed: lobby.currentRound,
			points: lobby.points
		};
		if(lobby.visible) list.push(lobbyObj);
	}
	genResponse(res,[["Content-Type","text/json"]],200);
	res.send(list);
	return;
});
app.get("/api/lobby/info",(req,res)=>{ // Joined lobby info
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	// Check if token exist
	if(token === null) {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyInfoSyntax[0],
			message: httpResponses.lobbyInfoSyntax[1],
		};
		res.send(rs);
		return;
	}
	// Check if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyInfoUnauthorized[0],
			message: httpResponses.lobbyInfoUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// Check if user is in lobby
	let plr = getPlayer(token);
	if(plr.action!='room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyInfoNotInLobby[0],
			message: httpResponses.lobbyInfoNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	// Check if user is host (if not, send only settings info)
	let limitedInfo = true; // Is user guest?
	let lb; // Current lobby
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			if(lby.host.name == plr.name) limitedInfo = false;
			lb = lby;
		}
	}
	let dataCollection = {
		name:			lb.name,
		id:				lb.id,
		host:			lb.host,
		guest: 			lb.guest ? lb.guest : null, 
		setting:		lb.boardSetting,
		status: 		lb.gameStatus,
		roundsTotal: 	lb.rounds,
		roundsPlayed:	lb.currentRound,
		points:			lb.points,
		isHost:			false,
		chatHistory:	lb.chatHistory
	};
	if(!limitedInfo) { // User is host
		dataCollection.isHost = true;
		dataCollection.inviteCode = lb.inviteCode;
		dataCollection.visible = lb.visible;
	}
	genResponse(res,[["Content-Type","text/json"]],200);
	res.send(dataCollection);
	return;
});
app.post("/api/lobby/new",(req,res)=>{ // New lobby
	let body = req.body;
	// Check if cookie with auth is set
	if(!req.cookies.token||!body.name) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyCreateSyntax[0],
			message: httpResponses.lobbyCreateSyntax[1]
		};
		res.send(rs);
		return;
	}
	// Check if auth is valid
	if(!checkAuth(req.cookies.token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyCreateUnauthorized[0],
			message: httpResponses.lobbyCreateUnauthorized[1]
		};
		res.send(rs);
		return;
	}
	// Check if name is valid
	let nameRgx = /^[a-zA-Z0-9\!\@\#\$\%\^\&\*\_\-]+$/g;
	if(body.name.length<4||body.name.length>20||!nameRgx.test(body.name)) {
		genResponse(res,[['Content-Type','text/json']],400);
		let rs = {
			code: httpResponses.lobbyCreateInvalidName[0],
			message: httpResponses.lobbyCreateInvalidName[1],
		};
		res.send(rs);
		return;
	}
	// Check if name is in use
	for(let lb of lobbies) {
		if(lb.name.toLowerCase()  == body.name.toLowerCase()) {
			genResponse(res,[['Content-Type','text/json']],400);
			let rs = {
				code: httpResponses.lobbyCreateNameInUse[0],
				message: httpResponses.lobbyCreateNameInUse[1],
			};
			res.send(rs);
			return;
		}
	}
	// Check if user is in lobby
	if(getPlayer(req.cookies.token).action != 'lobby') {
		genResponse(res,[['Content-Type','text/json']],403);
		let rs = {
			code: httpResponses.lobbyCreateInvalidAction[0],
			message: httpResponses.lobbyCreateInvalidAction[1],
		};
		res.send(rs);
		return;
	}
	lobbyIncrement++;
	let lobbyCreated = new Lobby(body.name,false,getPlayer(req.cookies.token).getID());
	lobbies.push(lobbyCreated);
	getPlayer(req.cookies.token).action = 'room';
	getPlayer(req.cookies.token).lobbyJoined = lobbyCreated.id;
	lobbyCreated.newMsg(playerDatabase[0],`<i>${getPlayer(req.cookies.token).name} created the room</i>`);
	genResponse(res,[['Content-Type','text/json']],200);
	let rs = {
		code: httpResponses.lobbyCreateSuccess[0],
		message: httpResponses.lobbyCreateSuccess[1],
	};
	res.send(rs);
	return;
});
app.post("/api/lobby/join",(req,res)=>{ // Join lobby
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	// Check if user is authed
	if(token === null) {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyCreateSyntax[0],
			message: httpResponses.lobbyCreateSyntax[1],
		};
		res.send(rs);
		return;
	}
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyCreateUnauthorized[0],
			message: httpResponses.lobbyCreateUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// Check if body contains code
	if(!body.code||body.code=="") {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyJoinSyntax[0],
			message: httpResponses.lobbyJoinSyntax[1],
		};
		res.send(rs);
		return;
	}
	// Check if room with that code exists
	for(let lb of lobbies) {
		if(lb.inviteCode == body.code) {
			// Check if room is full
			if(lb.guest != null) {
				genResponse(res,[["Content-Type","text/json"]],403);
				let rs = {
					code: httpResponses.lobbyJoinRoomFull[0],
					message: httpResponses.lobbyJoinRoomFull[1],
				};
				res.send(rs);
				return;
			}
			let usr = getPlayer(token);
			lb.guest = usr.getID();
			usr.action = 'room';
			usr.lobbyJoined = lb.id;
			lb.newMsg(playerDatabase[0],`<i>${usr.name} joined the room</i>`);
			lb.gameStatus='full';
			genResponse(res,[["Content-Type","text/json"]],200);
			let rs = {
				code: httpResponses.lobbyJoinSuccess[0],
				message: httpResponses.lobbyJoinSuccess[1],
			};
			res.send(rs);
			return;
		}
	}
	genResponse(res,[["Content-Type","text/json"]],403);
	let rs = {
		code: httpResponses.lobbyJoinInvalidCode[0],
		message: httpResponses.lobbyJoinInvalidCode[1],
	};
	res.send(rs);
	return;
});
app.get("/api/lobby/leave",(req,res)=>{ // Leave lobby
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	// if token is set
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyLeaveSyntax[0],
			message: httpResponses.lobbyLeaveSyntax[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyLeaveSyntax[0],
			message: httpResponses.lobbyLeaveSyntax[1],
		};
		res.send(rs);
		return;
	}
	// if user is in room
	let plr = getPlayer(token);
	if(plr.lobbyJoined == null || plr.action !='room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyLeaveNotInLobby[0],
			message: httpResponses.lobbyLeaveNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	// if user is host
	let isHost = false;
	let hasGuest = false;
	let lb; // Current lobby
	let lbIndex = null;
	for(let i in lobbies){
		let lby = lobbies[i];
		if(lby.id == plr.lobbyJoined) { 
			lb = lby;
			lbIndex = i;
			if(lby.host.name == plr.name) {
				isHost = true;
			}
		}
	}
	// if lobby has guest
	if(lb.guest) hasGuest = true;
	// if host is leaving, guest exists, make him host
	if(isHost&&hasGuest) {
		lb.newMsg(playerDatabase[0],`<i>${plr.name} left the room, ${lb.guest.name} is now Host</i>`);
		lb.makeGuestHost();
		lb.gameStatus = 'open';
		lobbies[lbIndex] = lb;
		plr.action = 'lobby';
		plr.lobbyJoined = null;
	}
	// if guest is leaving, remove him
	if(!isHost) {
		lb.removeGuest();
		lb.newMsg(playerDatabase[0],`<i>${plr.name} left the room</i>`);
		lb.gameStatus = 'open';
		plr.lobbyJoined = null;
		plr.action = 'lobby';
		lobbies[lbIndex] = lb;
	}
	// if guest is nonexistent, remove lobby
	if(isHost&&!hasGuest) {
		plr.lobbyJoined = null;
		plr.action = 'lobby';
		lobbies.splice(lbIndex,1);
	}
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyLeaveSuccess[0],
		message: httpResponses.lobbyLeaveSuccess[1],
	};
	res.send(rs);
	return;
});
app.post("/api/lobby/settings",(req,res)=>{ // Lobby settings update
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	// if user has options,token
	if(!body.mode||!body.rounds||typeof body.visibility != 'boolean') {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyUpdateSyntax[0],
			message: httpResponses.lobbyUpdateSyntax[1],
		};
		res.send(rs);
		return;
	}
	// if user's auth is valid
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyUpdateUnauthorized[0],
			message: httpResponses.lobbyUpdateUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyUpdateUnauthorized[0],
			message: httpResponses.lobbyUpdateUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if user is in room
	let plr = getPlayer(token);
	if(plr.action != 'room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyUpdateNotInLobby[0],
			message: httpResponses.lobbyUpdateNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	getPlayer(token).getToken(token).extend();
	res.cookie('token',req.cookies.token,{expires: getPlayer(token).getToken(token).expires,httpOnly:true});
	// if user is host
	let lb; // Current lobby
	let isHost = false;
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			if(lby.host.name == plr.name) isHost = true;
			lb = lby;
		}
	}
	if(!isHost) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyUpdateUnauthorized[0],
			message: httpResponses.lobbyUpdateUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// input sanitizing
	let mode = body.mode;
	let rounds = body.rounds;
	let vs = body.visibility;
	if(!parseInt(mode)||mode<1||mode>3||!parseInt(rounds)||rounds<1||rounds>99||typeof vs != 'boolean') {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.lobbyUpdateInvalidOptions[0],
			message: httpResponses.lobbyUpdateInvalidOptions[1],
		};
		res.send(rs);
		return;
	}
	mode = parseInt(mode);
	rounds = parseInt(rounds);
	switch(mode) {
		case 1: // 3x3
			lb.boardSetting = "3x3";
			break;
		case 2: // 4x4
			lb.boardSetting = "4x4";
			break;
		case 3: // 5x5
			lb.boardSetting = "5x5";
			break;
	}
	lb.rounds = rounds;
	lb.visible = vs;
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyUpdateSuccess[0],
		message: httpResponses.lobbyUpdateSuccess[1],
	};
	res.send(rs);
	return;
});
app.get("/api/lobby/kickGuest",(req,res)=>{ // Kick guest
	let token = req.cookies.token ? req.cookies.token : null;
	//if token exists
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyKickUnauthorized[0],
			message: httpResponses.lobbyKickUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyKickUnauthorized[0],
			message: httpResponses.lobbyKickUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if user is in room
	let plr = getPlayer(token);
	if(plr.lobbyJoined == null || plr.action !='room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyKickNotInLobby[0],
			message: httpResponses.lobbyKickNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	getPlayer(token).getToken(token).extend();
	res.cookie('token',req.cookies.token,{expires: getPlayer(token).getToken(token).expires,httpOnly:true});
	// if user is host
	let lb; // Current lobby
	let isHost = false;
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			if(lby.host.name == plr.name) isHost = true;
			lb = lby;
		}
	}
	if(!isHost) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyKickUnauthorized[0],
			message: httpResponses.lobbyKickUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if guest exists
	if(!lb.guest) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyKickNoGuest[0],
			message: httpResponses.lobbyKickNoGuest[1],
		};
		res.send(rs);
		return;
	}
	let gplr; 
	for(let fplr of playerDatabase) { // get guest object
		if(fplr.id == lb.guest.id) {
			gplr = fplr;
		}
	}
	gplr.action = 'lobby';
	gplr.lobbyJoined = null;
	lb.guest = null; // clear guest
	lb.newMsg(playerDatabase[0],`<i>${gplr.name} was kicked out</i>`);
	lb.gameStatus = 'open';
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyKickSuccess[0],
		message: httpResponses.lobbyKickSuccess[1],
	};
	res.send(rs);
	return;

});
app.get("/api/lobby/start",(req,res)=>{ // Start game
	let token = req.cookies.token ? req.cookies.token : null;
	// if token exists
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyStartUnauthorized[0],
			message: httpResponses.lobbyStartUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyStartUnauthorized[0],
			message: httpResponses.lobbyStartUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if user is in room
	let plr = getPlayer(token);
	if(plr.lobbyJoined == null || plr.action !='room') {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.lobbyStartNotInLobby[0],
			message: httpResponses.lobbyStartNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	getPlayer(token).getToken(token).extend();
	res.cookie('token',req.cookies.token,{expires: getPlayer(token).getToken(token).expires,httpOnly:true});
	// if user is host
	let lb; // Current lobby
	let isHost = false;
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			if(lby.host.name == plr.name) isHost = true;
			lb = lby;
		}
	}
	if(!isHost) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyStartUnauthorized[0],
			message: httpResponses.lobbyStartUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if guest exists
	if(!lb.guest) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.lobbyStartNoGuest[0],
			message: httpResponses.lobbyStartNoGuest[1],
		};
		res.send(rs);
		return;
	}
	let gplr; 
	for(let fplr of playerDatabase) { // get guest object
		if(fplr.id == lb.guest.id) {
			gplr = fplr;
		}
	}
	lb.gameStatus = 'game';
	plr.action = 'game';
	gplr.action = 'game';
	lb.initBoard();
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyStartSuccess[0],
		message: httpResponses.lobbyStartSuccess[1],
	};
	res.send(rs);
	return;
});
app.get("/api/game/data",(req,res)=>{ // Get board info
	let token = req.cookies.token ? req.cookies.token : null;
	// Check if token exist
	if(token === null) {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.gameDataSyntax[0],
			message: httpResponses.gameDataSyntax[1],
		};
		res.send(rs);
		return;
	}
	// Check if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.gameDataUnauthorized[0],
			message: httpResponses.gameDataUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// Check if user is in lobby
	let plr = getPlayer(token);
	if(plr.action!='game') {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gameDataNotInGame[0],
			message: httpResponses.gameDataNotInGame[1],
		};
		res.send(rs);
		return;
	}
	// find lobby
	let lb; // Current lobby
	for(let lby of lobbies )
		if(lby.id == plr.lobbyJoined) lb = lby;
	let dataCollection = {
			name:				lb.name,
			id:					lb.id,
			host:				lb.host,
			guest: 				lb.guest ? lb.guest : null, 
			setting:			lb.boardSetting,
			status: 			lb.gameStatus,
			roundsTotal: 		lb.rounds,
			roundsPlayed:		lb.currentRound,
			board:				lb.gameBoard.cells,
			yourTurn: 			lb.gameBoard.isTurn(plr),
			yourName:			plr.name,
			yourOpponentName:	plr.name == lb.host.name ?lb.guest.name : lb.host.name,
			points:				lb.points,
	};
	if(lb.gameBoard.checkMatches()) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gameDataOpponentWon[0],
			message: httpResponses.gameDataOpponentWon[1],
			content: dataCollection
		};
		res.send(rs);
		// if(lb.gameStatus!='win') {
		// 	lb.gameStatus = 'win';
		// 	//lb.points[1]++;
		// 	//lb.currentRound++;
		// 	setTimeout(()=>{
		// 		lb.initBoard();
		// 	},5000);
		// }
		return;
	}
	// if room is in play, not win state
	// if(lb.gameStatus == 'win') {
	// 	genResponse(res,[["Content-Type","text/json"]],403);
	// 	let rs = {
	// 		code: httpResponses.gameDataNotPlaying[0],
	// 		message: httpResponses.gameDataNotPlaying[1],
	// 	};
	// 	res.send(rs);
	// 	return;
	// }
	if(lb.gameBoard.boardFull()) { // if board is full
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gameDataDraw[0],
			message: httpResponses.gameDataDraw[1],
		};
		res.send(rs);
		
		return;
	}
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.gameDataSuccess[0],
		message: httpResponses.gameDataSuccess[1],
		content: dataCollection
	};
	res.send(rs);
	return;
});
app.post("/api/game/place",(req,res)=>{ // Place sign (O or X)
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	// Check if body exist
	if(!body.box||typeof body.box.y == 'undefined'||typeof body.box.x == 'undefined') {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.gamePlaceSyntax[0],
			message: httpResponses.gamePlaceSyntax[1],
		};
		res.send(rs);
		return;
	}
	// Check if token exist
	if(token === null) {
		genResponse(res,[["Content-Type","text/json"]],400);
		let rs = {
			code: httpResponses.gamePlaceSyntax[0],
			message: httpResponses.gamePlaceSyntax[1],
		};
		res.send(rs);
		return;
	}
	// Check if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.gamePlaceUnauthorized[0],
			message: httpResponses.gamePlaceUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// Check if user is in game
	let plr = getPlayer(token);
	if(plr.action!='game') {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gamePlaceNotInGame[0],
			message: httpResponses.gamePlaceNotInGame[1],
		};
		res.send(rs);
		return;
	}
	// find lobby
	let lb; // Current lobby
	for(let lby of lobbies )
		if(lby.id == plr.lobbyJoined) lb = lby;
	// if it's user's turn
	if(!lb.gameBoard.isTurn(plr)) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gamePlaceWrongTurn[0],
			message: httpResponses.gamePlaceWrongTurn[1],
		};
		res.send(rs);
		return;
	}
	// if box is available
	if(lb.gameBoard.getBox(body.box.x,body.box.y).ox !== null) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gamePlaceBoxTaken[0],
			message: httpResponses.gamePlaceBoxTaken[1],
		};
		res.send(rs);
		return;
	}
	lb.gameBoard.getBox(body.box.x,body.box.y).ox = lb.gameBoard.turn; // Set sign
	// if somebody won
	if(lb.gameBoard.checkMatches()) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gamePlaceUserWon[0],
			message: httpResponses.gamePlaceUserWon[1],
		};
		res.send(rs);
		if(lb.gameStatus!='win') {
			lb.gameStatus = 'win';
			if(plr.name==lb.host.name) lb.points[0]++;
			else lb.points[1]++;
			lb.currentRound++;
			setTimeout(()=>{
				lb.initBoard();
			},5000);
		}
		return;
	}
	if(lb.gameBoard.boardFull()) {
		genResponse(res,[["Content-Type","text/json"]],200);
		let rs = {
			code: httpResponses.gamePlaceBoardFull[0],
			message: httpResponses.gamePlaceBoardFull[1],
		};
		res.send(rs);
		return;
	}
	// if room is in play, not win state
	// if(lb.gameStatus == 'win') {
	// 	genResponse(res,[["Content-Type","text/json"]],403);
	// 	let rs = {
	// 		code: httpResponses.gamePlaceNotPlaying[0],
	// 		message: httpResponses.gamePlaceNotPlaying[1],
	// 	};
	// 	res.send(rs);
	// 	return;
	// }
	lb.gameBoard.turn = !lb.gameBoard.turn;
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.gamePlaceSuccess[0],
		message: httpResponses.gamePlaceSuccess[1],
	};
	res.send(rs);
	return;
});
app.get("/api/lobby/chat",(req,res)=>{ // Get message
	let token = req.cookies.token ? req.cookies.token : null;
	//if token exists
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatUnauthorized[0],
			message: httpResponses.lobbyChatUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatUnauthorized[0],
			message: httpResponses.lobbyChatUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	// if user is in room
	let plr = getPlayer(token);
	if(plr.lobbyJoined == null || plr.action !='room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatNotInLobby[0],
			message: httpResponses.lobbyChatNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	// get Lobby
	let lb; // Current lobby
	let isHost = false;
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			lb = lby;
		}
	}
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyChatSuccess[0],
		message: httpResponses.lobbyChatSuccess[1],
		chat: lb.chatHistory
	};
	res.send(rs);
	return;
});
app.post("/api/lobby/chat",(req,res)=>{ // Send message
	let body = req.body;
	let token = req.cookies.token ? req.cookies.token : null;
	//if token exists
	if(token==null) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatSendUnauthorized[0],
			message: httpResponses.lobbyChatSendUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	if(!body.content||body.content.length>50) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatSendUnsafe[0],
			message: httpResponses.lobbyChatSendUnsafe[1],
		};
		res.send(rs);
		return;
	}
	// if token is valid
	if(!checkAuth(token)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatSendUnauthorized[0],
			message: httpResponses.lobbyChatSendUnauthorized[1],
		};
		res.send(rs);
		return;
	}
	getPlayer(token).getToken(token).extend();
	res.cookie('token',req.cookies.token,{expires: getPlayer(token).getToken(token).expires,httpOnly:true});
	// if user is in room
	let plr = getPlayer(token);
	if(plr.lobbyJoined == null || plr.action !='room') {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatSendNotInLobby[0],
			message: httpResponses.lobbyChatSendNotInLobby[1],
		};
		res.send(rs);
		return;
	}
	// get Lobby
	let lb; // Current lobby
	for(let lby of lobbies ){
		if(lby.id == plr.lobbyJoined) { 
			lb = lby;
		}
	}
	let rgxp = /^[^<>]+$/g;
	// Check for dangerous signs
	if(!rgxp.test(body.content)) {
		genResponse(res,[["Content-Type","text/json"]],403);
		let rs = {
			code: httpResponses.lobbyChatSendUnsafe[0],
			message: httpResponses.lobbyChatSendUnsafe[1],
		};
		res.send(rs);
		return;
	}
	lb.newMsg(plr,body.content);
	genResponse(res,[["Content-Type","text/json"]],200);
	let rs = {
		code: httpResponses.lobbyChatSendSuccess[0],
		message: httpResponses.lobbyChatSendSuccess[1],
	};
	res.send(rs);
	return;
});
// GAME

app.use((req,res)=>{ // 404 route
	res.set("Content-Type","text/html");
	res.status(404);
	res.send("ERROR 404");
});
