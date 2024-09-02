const { invoke } = window.__TAURI__.tauri;

let dateMsgEl;
let barChart;
let lineChart;

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
    await updateBarChart(modal.dataset.containerId, "+");
    await updateLineChart(modal.dataset.containerId, "+");
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
  delTaskBtns.forEach(async delTaskBtn => {
    await addDeleteCardOnclick(delTaskBtn);
  });
}

async function addDeleteCardOnclick(delTaskBtn) {
  delTaskBtn.onclick = async function() {
    let graggable = delTaskBtn.parentNode;
    await deleteCard(graggable.id);
    let containerId = graggable.parentNode.id;
    await updateBarChart(containerId, "-");
    await updateLineChart(containerId, "-");
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
      let removedFromContainerId = draggedElement.parentNode.id;
      draggedElement.parentNode.removeChild(draggedElement);
      container.appendChild(draggedElement);
      // Then we need to change container_id to new one:
      await updateCard(draggedElement.id, null, container.id);
      // remove card from this bar in chart:
      await updateBarChart(removedFromContainerId, "-");
      // add card for this bar in chart:
      await updateBarChart(container.id, "+");

      // remove card from this line in chart:
      await updateLineChart(removedFromContainerId, "-");
      // add card for this line in chart:
      await updateLineChart(container.id, "+");
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

async function getAndSetContainersIds(currentDate) {
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
}

async function handleArrowClick() {
  clearAllDraggableDivs();
  let currentDate = dateMsgEl.textContent;
  await getAndSetContainersIds(currentDate);
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

async function drawBarChart() {
  let stats = await invoke("get_stats_4_bar");
  let labels = [];
  let adata = [];
  for (let i = 0; i < stats.length; i++) {
    labels.push(stats[i]["status"]);
    adata.push(stats[i]["count"]);
  }

  const ctx = document.getElementById('barChart');
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '# of Tasks',
        data: adata,
        borderWidth: 1,
        backgroundColor: ["red", "grey", "green"]
      }]
    },
    options: {
      plugins: {
        legend: {
          labels: {
            font: {
                size: 22
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function updateBarChart(containerId, flag) {
  await invoke(
    'get_container_status_by_id',
    { containerId: parseInt(containerId) }).then((containerStatus) => {
      barChart.data.datasets.forEach((dataset) => {
        for (let i = 0; i < barChart.data.labels.length; i++) {
          if (barChart.data.labels[i] === containerStatus) {
            if (flag === "+") {
              dataset.data[i] += 1
            } else if (flag === "-") {
              dataset.data[i] -= 1
            }
            else {
              console.assert(1===2, `Error: strange flag, ${flag}`);
            }
            break
          };
        };
      });
      barChart.update();
  });
};

async function drawLineChart() {
  let stats = await invoke("get_stats_4_line");

  let datasets = [
    {
      label: 'Todo',
      data: [],
      fill: false,
      borderColor: 'red',
      tension: 0.1
    },
    {
      label: 'Doing',
      data: [],
      fill: false,
      borderColor: 'grey',
      tension: 0.1
    },
    {
      label: 'Done',
      data: [],
      fill: false,
      borderColor: 'green',
      tension: 0.1
    }
  ];

  let labels = [];
  for (let i = 0; i < stats.length; i++) {
    if (!labels.includes(stats[i]["date"])) {
      labels.push(stats[i]["date"]);
    };
    for (let j = 0; j < datasets.length; j++) {
      if (stats[i]["status"].toLowerCase() === datasets[j].label.toLowerCase()) {
        datasets[j].data.push(stats[i]["count"]);
        break;
      }
    };
  }

  const ctx = document.getElementById('lineChart');
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      plugins: {
        legend: {
          labels: {
            font: {
                size: 22
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function updateLineChart(containerId, flag) {
  await invoke(
    'get_container_status_by_id',
    { containerId: parseInt(containerId) }).then((containerStatus) => {
      let dateIndex;
      // first find labels index (right date):
      for (let i = 0; i < lineChart.data.labels.length; i++) {
        if (lineChart.data.labels[i].toLowerCase() === dateMsgEl.textContent.toLowerCase()) {
          dateIndex = i;
          break;
        };
      };
      // then iterate over all datasets to find right status dataset:
      for (let j = 0; j < lineChart.data.datasets.length; j++) {
        if (lineChart.data.datasets[j].label.toLowerCase() === containerStatus.toLowerCase()) {
          if (flag === "+") {
            lineChart.data.datasets[j].data[dateIndex] += 1;
          } else if (flag === "-") {
            lineChart.data.datasets[j].data[dateIndex] -= 1;
          } else {
            console.assert(1===2, `Error: strange flag, ${flag}`);
          }
          break;
        }
      };
      lineChart.update();
  });
}

async function setCategoriesOptions() {
  let cats = await invoke('get_categories');
  let catSelectEl = document.getElementById("categories");
  for (let i = 0; i < cats.length; i++) {
    const newOption = document.createElement("option");
    newOption.setAttribute("value", cats[i]);
    newOption.innerHTML = cats[i];
    catSelectEl.appendChild(newOption);
  };
};

window.addEventListener("DOMContentLoaded", async () => {
  dateMsgEl = document.querySelector("#date-msg");

  await initGetDate();
  await getAndSetContainersIds(dateMsgEl.textContent);
  await getCards(dateMsgEl.textContent);
  handleTaskDelete();
  handleModal();
  handleDragging();
  handleArrows();
  await setCategoriesOptions();

  await drawBarChart();
  await drawLineChart();




});


