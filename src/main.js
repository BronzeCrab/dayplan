const { invoke } = window.__TAURI__.tauri;

let debugMsgEl;

async function updateCard(cardId, cardText, newContainerId) {
  debugMsgEl.textContent = await invoke(
    "update_card", 
    {cardId: parseInt(cardId), cardText: cardText, newContainerId: parseInt(newContainerId) });
}

async function deleteCard(cardId) {
  debugMsgEl.textContent = await invoke("delete_card", { cardId: parseInt(cardId) });
}

async function createCard(cardText, containerId) {
  containerId = parseInt(containerId);
  let card = await invoke(
    "create_card", 
    { cardText: cardText, containerId: containerId }
  );

  console.assert(card.container_id === containerId, "error card.containerId != containerId");

  let newDiv = createNewDraggableDiv(card);
  let containers = document.getElementsByClassName("container");
  appendDraggableToContainer(newDiv, containerId, containers);
}

async function getPrevOrNextDate(dir) {
  debugMsgEl.textContent = await invoke(
    "get_prev_or_next_date", { currentDateStr: debugMsgEl.textContent, dir: dir });
}

function createNewDraggableDiv(card) {
  const newDiv = document.createElement("div");
  newDiv.setAttribute("id", card.id);
  newDiv.setAttribute("class", "draggable");
  newDiv.setAttribute("draggable", "true");
  newDiv.setAttribute("contenteditable", true);
  newDiv.setAttribute("style", "border: solid magenta; width:100px;");
  newDiv.innerHTML = card.text

  // Creating delete btn for this new card:
  const newDelTaskBtn = document.createElement("button");
  newDelTaskBtn.setAttribute("class", "delTaskBtn");
  newDelTaskBtn.innerHTML = "Delete task";
  addDeleteCardOnclick(newDelTaskBtn);
  newDiv.appendChild(newDelTaskBtn);

  addDraggableEventListeners(newDiv);
  return newDiv;
}

function appendDraggableToContainer(newDiv, containerId, containers) {
  let cardContainer = containers[containerId - 1];
  if (cardContainer !== undefined) {
    cardContainer.appendChild(newDiv);
  }
}

async function initGetCards() {
  await invoke('get_cards').then((cards) => {
    let containers = document.getElementsByClassName("container");
    for (let i = 0; i < cards.length; i++) {
      let newDiv = createNewDraggableDiv(cards[i]);
      let containerId = cards[i].container_id;
      appendDraggableToContainer(newDiv, containerId, containers);
    }
  });
}

function initGetDate() {
  invoke('get_init_date').then((todayDate) => {
      debugMsgEl.textContent = todayDate;
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
  // user clicked on specific btn in specific container, so
  // just set current param to modal.dataset:
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
      // Then we need to change container_id:
      updateCard(draggedElement.id, null, container.id);
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
    console.assert(draggable.childNodes[0].nodeType === Node.TEXT_NODE);
    updateCard(draggable.id, draggable.childNodes[0].textContent, null);
  });
}

function clearAllDraggableDivs() {
  var draggables = document.getElementsByClassName('draggable');

  while(draggables[0]) {
    draggables[0].parentNode.removeChild(draggables[0]);
  }
}

function handleArrows() {
  var leftArrow = document.getElementById("leftArrow");
  var rightArrow = document.getElementById("rightArrow");

  // When the user clicks on this arrow, go back:
  leftArrow.onclick = function() {
    console.log('left');
    clearAllDraggableDivs();
    getPrevOrNextDate("left");
  }

  // When the user clicks on this arrow, go forward:
  rightArrow.onclick = function() {
    console.log('right');
    clearAllDraggableDivs();
    getPrevOrNextDate("right");
  }

}

window.addEventListener("DOMContentLoaded", () => {
  // TODO: remove it later:
  debugMsgEl = document.querySelector("#debug-msg");

  initGetCards();
  initGetDate();
  handleTaskDelete();
  handleModal();
  handleDragging();
  handleArrows();

});


