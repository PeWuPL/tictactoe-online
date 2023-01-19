var loop = null;
var isPlacing = false;
var cnt = null;
var $ = (elem)=>{
	return document.querySelector(elem);
};
var init = async ()=>{ // Initialize document. Display board
	
	let ldHook = $("#loading");
	let ctHook = $("#content");
	let tpHook = $("#panel-top");
	let btHook = $("#panel-bottom");
	let bdHook = $("#board");
	let errHook = $("#errMsg");
	loop = setInterval(async ()=>{// Game loop
		if(isPlacing) return;
		let data = await getData("/api/game/data");
		/**
		{
		    "code": 2100,
		    "message": "Game data fetch successful",
		    "content": {
		        "name": "ASDASD",
		        "id": 21,
		        "host": {
		            "name": "dummy1",
		            "id": 1
		        },
		        "guest": {
		            "name": "dummy2",
		            "id": 2
		        },
		        "setting": "3x3",
		        "status": "game",
		        "roundsTotal": 1,
		        "roundsPlayed": 0,
		        "board": [...],
		        "turn": true,
		        "points": [
		            0,
		            0
		        ]
		    }
		}
		 */
		let str='';
		if(data.code != 2100) {
			if(data.code == 2103) { // Not authorized
				window.location.reload();
				clearInterval(loop);
				return;
			}
			if(data.code == 2104) { // Opponent won
				$('#turn').innerHTML = "YOU LOST!";
				// wait 5s, highlight streak, reset the board (server)
				for(let i in data.content.board) {
					let row = data.content.board[i];
					for(let j in row) {
						let cell = row[j];
						if(cell.ox == null) 
							str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bEm"></div>`;
						else if (cell.ox == true) 
							str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bX"><div>X</div></div>`;
						else 
							str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bO"><div>O</div></div>`;
					}
				}
				$('#board').innerHTML = str;
				await new Promise((res)=>{setTimeout(()=>res(),5000);});
				window.location.reload();
				clearInterval(loop);
				return;
			}
			errHook.innerHTML = data.message;
			return;
		}
		if(data.content.yourTurn == true) $('#turn').innerHTML = "Your turn!";
		else $('#turn').innerHTML = data.content.yourOpponentName+"'s turn!";
		cnt = data.content;
		for(let i in data.content.board) {
			let row = data.content.board[i];
			for(let j in row) {
				let cell = row[j];
				if(cell.ox == null) 
					str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bEm"></div>`;
				else if (cell.ox == true) 
					str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bX"><div>X</div></div>`;
				else 
					str+=`<div onclick="setBox(${i},${j})" class="boardCell${data.content.setting[0]} bO"><div>O</div></div>`;
			}
		}
		if(str!=bdHook.innerHTML) {
			bdHook.innerHTML = str;
		}
		$('#score').innerHTML = `${data.content.host.name} ${data.content.points[0]} : ${data.content.points[1]} ${data.content.guest.name}<br><h3 style="font-size:50%">Round ${~~data.content.roundsPlayed+1} of ${data.content.roundsTotal}</h3>`;
		if(ctHook.style.display == '') { // start() equiv (arduino)
			ctHook.style.display = 'block';
			tpHook.style.display = 'block';
			btHook.style.display = 'block';
			ldHook.style.display = 'none';
		}
	},1000);
};
var setBox = async (x,y)=>{
	let data = await postData("/api/game/place",{box: {x: x,y: y}});
	let boardData = await getData("/api/game/data");
	boardData = boardData.content;
	if(data.code != 2200) {
		if(data.code == 2206) { // User won
			isPlacing = true;
			$('#turn').innerHTML = "YOU WON!";
			let str = '';
			for(let i in boardData.board) {
				let row = boardData.board[i];
				for(let j in row) {
					let cell = row[j];
					if(cell.ox == null) 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bEm"></div>`;
					else if (cell.ox == true) 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bX"><div>X</div></div>`;
					else 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bO"><div>O</div></div>`;
				}
			}
			$('#board').innerHTML = str;
			clearInterval(loop);
			await new Promise((res)=>{setTimeout(()=>res(),5000);});
			isPlacing=false;
			window.location.reload();
			return;
		}
		if(data.code == 2209) { // Draw
			isPlacing = true;
			$('#turn').innerHTML = "DRAW";
			let str = '';
			for(let i in boardData.board) {
				let row = boardData.board[i];
				for(let j in row) {
					let cell = row[j];
					if(cell.ox == null) 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bEm"></div>`;
					else if (cell.ox == true) 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bX"><div>X</div></div>`;
					else 
						str+=`<div onclick="setBox(${i},${j})" class="boardCell${boardData.setting[0]} bO"><div>O</div></div>`;
				}
			}
			$('#board').innerHTML = str;
			clearInterval(loop);
			await new Promise((res)=>{setTimeout(()=>res(),5000);});
			isPlacing=false;
			window.location.reload();
			return;
		}
		$('#errMsg').innerHTML = data.message;
		return;
	}	
};
