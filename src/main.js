const { invoke } = window.__TAURI__.tauri;

let dateMsgEl;

async function updateCard(cardId, cardText, newContainerId) {
  await invoke(
    "update_card", 
    {cardId: parseInt(cardId), cardText: cardText, newContainerId: parseInt(newContainerId) });
}

async function deleteCard(cardId) {
  await invoke("delete_card", { cardId: parseInt(cardId) });
}

async function createCard(cardText, containerId) {
  containerId = parseInt(containerId);
  let card = await invoke(
    "create_card", 
    { cardText: cardText, containerId: containerId }
  );

  console.assert(card.container_id === containerId, "error card.containerId != containerId");

  let newDiv = createNewDraggableDiv(card);
  appendDraggableToContainer(newDiv, containerId);
}

async function getPrevOrNextDate(dir) {
  dateMsgEl.textContent = await invoke(
    "get_prev_or_next_date", { currentDateStr: dateMsgEl.textContent, dir: dir });
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

function appendDraggableToContainer(newDiv, containerId) {
  let containers = document.getElementsByClassName("container");
  for (let i = 0; i < containers.length; i++) {
    if (parseInt(containers[i].id) === containerId) {
      containers[i].appendChild(newDiv);
      break;
    }
  }
}

async function getCards(currentDate) {
  await invoke('get_cards', { currentDate: currentDate }).then((cards) => {
    for (let i = 0; i < cards.length; i++) {
      let newDiv = createNewDraggableDiv(cards[i]);
      let containerId = cards[i].container_id;
      appendDraggableToContainer(newDiv, containerId);
    }
  });
}

async function initGetDate() {
  await invoke('get_init_date').then((todayDate) => {
      dateMsgEl.textContent = todayDate;
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
  taskCreateBtn.onclick = async function() {
    var taskCreateInput = document.getElementById("taskCreateInput");
    await createCard(taskCreateInput.value, modal.dataset.containerId);
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
  delTaskBtn.onclick = async function() {
    let graggable = delTaskBtn.parentNode;
    await deleteCard(graggable.id);
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

    container.addEventListener("drop", async function(event) {
      event.preventDefault();
      const draggedElement = document.querySelector(".dragging");
      draggedElement.parentNode.removeChild(draggedElement);
      container.appendChild(draggedElement);
      // Then we need to change container_id:
      await updateCard(draggedElement.id, null, container.id);
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
  draggable.addEventListener("input", async function() {
    console.assert(
      draggable.childNodes[0].nodeType === Node.TEXT_NODE, "nodeType should be TEXT");
    await updateCard(draggable.id, draggable.childNodes[0].textContent, null);
  });
}

function clearAllDraggableDivs() {
  var draggables = document.getElementsByClassName('draggable');

  while(draggables[0]) {
    draggables[0].parentNode.removeChild(draggables[0]);
  }
}

async function handleArrowClick() {
  clearAllDraggableDivs();
  let currentDate = dateMsgEl.textContent;
  await invoke(
    'try_to_create_date_and_containers',
    { currentDateStr: currentDate }).then((containers_ids) => {
      if (containers_ids.length > 0) {
        let containers = document.getElementsByClassName("container");
        console.assert(containers_ids.length === 3, "containers_ids.length should be 3");
        console.assert(
          containers_ids.length === containers.length,
          "containers_ids.length should be === containers.length"
        );
        // replace containers id's:
        for (let i = 0; i < containers.length; i++) {
          containers[i].id = containers_ids[i];
        }
      }
  });
  getCards(currentDate);
}

function handleArrows() {
  var leftArrow = document.getElementById("leftArrow");
  var rightArrow = document.getElementById("rightArrow");

  // When the user clicks on this arrow, go back:
  leftArrow.onclick = async function() {
    await getPrevOrNextDate("left");
    await handleArrowClick();
  }

  // When the user clicks on this arrow, go forward:
  rightArrow.onclick = async function() {
    await getPrevOrNextDate("right");
    await handleArrowClick();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // TODO: remove it later:
  dateMsgEl = document.querySelector("#date-msg");

  await initGetDate();
  await getCards(dateMsgEl.textContent);
  handleTaskDelete();
  handleModal();
  handleDragging();
  handleArrows();

});


