const { invoke } = window.__TAURI__.tauri;

let greetInputEl;
let greetMsgEl;

async function greet() {
  // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
  greetMsgEl.textContent = await invoke("greet", { name: greetInputEl.value });
}

async function updateCard(cardText, cardId) {
  greetMsgEl.textContent = await invoke("update_card", { cardText: cardText, cardId: parseInt(cardId) });
}

async function createCard(cardText) {
  let card = await invoke("create_card", { cardText: cardText, cardStatus: "todo" });
  const newDiv = document.createElement("div");
  newDiv.setAttribute("id", card.id);
  newDiv.setAttribute("class", "draggable");
  newDiv.setAttribute("draggable", "true");
  newDiv.setAttribute("contenteditable", true);
  newDiv.innerHTML = card.text;
  newDiv.setAttribute("style", "border: solid magenta; width:100px;");

  addDraggableEventListeners(newDiv);

  let containers = document.getElementsByClassName("container");
  for (let i = 0; i < containers.length; i++) {
    containers[i].appendChild(newDiv);
    break
  }
}

function addDraggableEventListeners(draggable) {
  draggable.addEventListener("dragstart", function(event) {
    draggable.classList.add("dragging");
    event.dataTransfer.setData('text/html', null);
  });
  draggable.addEventListener("dragend", function() {
    draggable.classList.remove("dragging");
  });
  draggable.addEventListener("input", function() {
    updateCard(draggable.textContent, draggable.id);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  invoke('get_cards').then((cards) => { 
    for (let i = 0; i < cards.length; i++) {
      console.log(cards[i]);
      const elem = document.getElementById(cards[i].id);
      if (elem !== null) {
        elem.textContent = cards[i].text;
      }
    }
   });

  // Get the modal
  var modal = document.getElementById("myModal");
  // Get the button that opens the modal
  var openModalBtn = document.getElementById("openModalBtn");
  // Get the button that creates the task in modal
  var taskCreateBtn = document.getElementById("taskCreateBtn");
  // Get the <span> element that closes the modal
  var span = document.getElementsByClassName("close")[0];

  // When the user clicks on this button, open the modal
  openModalBtn.onclick = function() {
    modal.style.display = "block";
  }
  // When the user clicks on this button, create task in db:
  taskCreateBtn.onclick = function() {
    var taskCreateInput = document.getElementById("taskCreateInput");
    createCard(taskCreateInput.value);
  }
  // When the user clicks on <span> (x), close the modal
  span.onclick = function() {
    modal.style.display = "none";
  }
  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }

  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form").addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  const draggables = document.querySelectorAll(".draggable");
  draggables.forEach(draggable => {
    addDraggableEventListeners(draggable);
  });

  const containers = document.querySelectorAll(".container");
  containers.forEach(container => {

    container.addEventListener("dragover", function(event) {
      event.preventDefault();
    });

    container.addEventListener("drop", function(event) {
      event.preventDefault();
      const draggedElement = document.querySelector(".dragging");
      draggedElement.parentNode.removeChild(draggedElement);
      container.appendChild(draggedElement);
    });
  });
});


