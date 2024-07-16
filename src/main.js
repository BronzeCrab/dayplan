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

window.addEventListener("DOMContentLoaded", () => {
  invoke('get_cards').then((message) => console.log(message));


  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form").addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  const draggables = document.querySelectorAll(".draggable");
  draggables.forEach(draggable => {
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


