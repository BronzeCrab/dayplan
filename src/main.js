const { invoke } = window.__TAURI__.tauri;

let debugMsgEl;

async function updateCard(cardText, cardId) {
  debugMsgEl.textContent = await invoke("update_card", { cardText: cardText, cardId: parseInt(cardId) });
}

async function deleteCard(cardId) {
  debugMsgEl.textContent = await invoke("delete_card", { cardId: parseInt(cardId) });
}

async function createCard(cardText, containerId) {
  containerId = parseInt(containerId);
  let card = await invoke("create_card", { cardText: cardText, cardStatus: "todo", containerId: containerId });
  const newDiv = document.createElement("div");
  newDiv.setAttribute("id", card.id);
  newDiv.setAttribute("class", "draggable");
  newDiv.setAttribute("draggable", "true");
  newDiv.setAttribute("contenteditable", true);

  // Creating delete btn for this new card:
  const newDelTaskBtn = document.createElement("button");
  newDelTaskBtn.setAttribute("class", "delTaskBtn");
  newDelTaskBtn.innerHTML = "Delete task";
  addDeleteCardOnclick(newDelTaskBtn);
  newDiv.innerHTML = card.text
  newDiv.appendChild(newDelTaskBtn);

  newDiv.setAttribute("style", "border: solid magenta; width:100px;");

  addDraggableEventListeners(newDiv);

  let containers = document.getElementsByClassName("container");
  for (let i = 0; i < containers.length; i++) {
    if (parseInt(containers[i].id) === containerId) {
      containers[i].appendChild(newDiv);
      break
    }
  }
}

function initGetCards() {
  invoke('get_cards').then((cards) => { 
    let graggable_elems = document.getElementsByClassName("draggable");
    for (let i = 0; i < cards.length; i++) {
      const graggableElem = graggable_elems[cards[i].id - 1];
      if (graggableElem !== undefined) {
        graggableElem.textContent = cards[i].text;
      }
    }
   });
}

function handleModal() {
  // Get the modal
  var modal = document.getElementById("myModal");
  // Get all the buttons that opens the modal
  var openModalBtns = document.getElementsByClassName("openModalBtn");
  // Get the button that creates the task in modal
  var taskCreateBtn = document.getElementById("taskCreateBtn");
  // Get the <span> element that closes the modal
  var span = document.getElementsByClassName("close")[0];

  // When the user clicks on this buttons, open the modal
  for (let i = 0; i < openModalBtns.length; i++) {
    openModalBtns[i].onclick = function() {
      modal.style.display = "block";
      modal.dataset.containerId = openModalBtns[i].parentNode.id;
    }
  }
  // When the user clicks on this button, create task in db:
  taskCreateBtn.onclick = function() {
    var taskCreateInput = document.getElementById("taskCreateInput");
    createCard(taskCreateInput.value, modal.dataset.containerId);
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
}

function handleTaskDelete() {
  const delTaskBtns = document.querySelectorAll(".delTaskBtn");
  delTaskBtns.forEach(delTaskBtn => {
    addDeleteCardOnclick(delTaskBtn);
  });
}

function addDeleteCardOnclick(delTaskBtn) {
  delTaskBtn.onclick = function() {
    let graggable = delTaskBtn.parentNode;
    deleteCard(graggable.id);
    graggable.remove();
  }
}

function handleDragging() {
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
  // TODO: remove it later:
  debugMsgEl = document.querySelector("#debug-msg");

  initGetCards();
  handleTaskDelete();
  handleModal();
  handleDragging();

});


