const { invoke } = window.__TAURI__.tauri;

let dateMsgEl;
let barChart;
let lineChart;
let polarChart;

async function updateCard(cardId, cardText, newContainerId, newCategoriesIds) {
  await invoke(
    "update_card", 
    {
      cardId: parseInt(cardId),
      cardText: cardText,
      newContainerId: parseInt(newContainerId),
      newCategoriesIds: newCategoriesIds 
    }
  );
}

async function deleteCard(cardId) {
  await invoke("delete_card", { cardId: parseInt(cardId) });
}

async function createCard(cardText, containerId, categoriesIds) {
  containerId = parseInt(containerId);
  let card;

  await invoke(
    "create_card", 
    { cardText: cardText, containerId: containerId, categoriesIds: categoriesIds }
  ).then(function(createdCard) {
    card = createdCard;
  })
  .catch(function(rej) {
    console.log(rej);
  });

  if (card === undefined) {
    return;
  }

  console.assert(card.container_id === containerId, "error card.containerId != containerId");

  let newDiv = createNewDraggableDiv(card);
  appendDraggableToContainer(newDiv, containerId);
  return card.id;
}

async function getAndSetPrevOrNextDate(dir) {
  dateMsgEl.textContent = await invoke(
    "get_prev_or_next_date", { currentDateStr: dateMsgEl.textContent, dir: dir });
}

function createNewDraggableDiv(card) {
  // create draggable div itself:
  const newDiv = document.createElement("div");
  newDiv.setAttribute("id", card.id);
  newDiv.setAttribute("class", "draggable");
  newDiv.setAttribute("draggable", "true");
  newDiv.setAttribute("contenteditable", true);
  newDiv.setAttribute("style", "border: solid magenta;");

  // create inner p with text:
  const newP = document.createElement("p");
  newP.innerHTML = card.text
  newDiv.appendChild(newP);

  // creating edit btn:
  const newEditTaskI = document.createElement("i");
  newEditTaskI.setAttribute("class", "fa-solid fa-pen-to-square editTaskBtn");
  newEditTaskI.setAttribute("contenteditable", false);
  addEditCardOnclick(newEditTaskI);
  newDiv.appendChild(newEditTaskI);

  // Creating delete btn for this new card:
  const newDelTaskI = document.createElement("i");
  newDelTaskI.setAttribute("class", "fa-solid fa-trash delTaskBtn");
  newDelTaskI.setAttribute("contenteditable", false);
  addDeleteCardOnclick(newDelTaskI);
  newDiv.appendChild(newDelTaskI);

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

function getSelectedCategoriesIds() {
  let categoriesIds = [];
  let catSelectEl = document.getElementById("categoriesSel");
  let selectedOptions = catSelectEl.selectedOptions;
  for (let i = 0; i < selectedOptions.length; i++) {
    categoriesIds.push(parseInt(selectedOptions[i].value));
  }
  return categoriesIds;
}

// Add create or edit btn on click handler inside modal:
function addCreateOrEditCardOnClick(taskCreateOrEditBtn, modal) {
  // When the user clicks on this button, create task in db:
  taskCreateOrEditBtn.onclick = async function() {
    var taskCreateInput = document.getElementById("taskCreateInput");
    let categoriesIds = getSelectedCategoriesIds();
    if (modal.dataset.flag === "create") {
      let createdCardRes = await createCard(
        taskCreateInput.value, modal.dataset.containerId, categoriesIds);
      if (createdCardRes !== undefined) {
        console.assert(
          Number.isInteger(createdCardRes),
          `ERROR: createdCardRes: ${createdCardRes} is not int!`
        );
        await updateBarChart(modal.dataset.containerId, "+");
        await updateLineChart(modal.dataset.containerId, "+");
        let createdCardId = createdCardRes;
        let categoriesNames = await getCategoriesNamesByTaskId(createdCardId);
        updatePolarChart(categoriesNames, "+");
      }
    }
    else if (modal.dataset.flag === "edit") {
      await updateCard(
        modal.dataset.editedTaskId, taskCreateInput.value, null, categoriesIds);

      // here we need to update card text:
      var draggables = document.getElementsByClassName('draggable');
      let foundDraggable = false;
      for (let i = 0; i < draggables.length; i++) {
        if (parseInt(draggables[i].id) === parseInt(modal.dataset.editedTaskId)) {
          draggables[i].childNodes[0].innerHTML = taskCreateInput.value;
          foundDraggable = true;
          break;
        }
      }
      if (foundDraggable === false) {
        console.assert(
          false,
          `ERROR: cant find draggable in update with id: ${modal.dataset.editedTaskId}`
        );
      }

      // here we need to restore array from string:
      let cetegoriesNamesBeforeEdit = modal.dataset.cetegoriesNamesBeforeEdit.split(',');
      updatePolarChart(cetegoriesNamesBeforeEdit, "-");
      let newCategoriesNames = await getCategoriesNamesByTaskId(modal.dataset.editedTaskId);
      updatePolarChart(newCategoriesNames, "+");
    }
    else {
      console.assert(false, `ERROR: unknown modal flag: ${modal.dataset.flag}`)
    }
  }
}

function handleModal() {
  // Get the modal
  var modal = document.getElementById("myModal");
  // Get all the buttons that opens the modal to create a card:
  var openModalCreateBtns = document.getElementsByClassName("openModalCreateBtn");
  // Get the button that creates the task in modal
  var taskCreateOrEditBtn = document.getElementById("taskCreateOrEditBtn");
  // Get the <i> element that closes the modal
  var iconClose = document.getElementsByClassName("close")[0];

  // When the user clicks on this buttons, open the modal
  // user clicked on specific btn in specific container, so
  // just set current param to modal.dataset:
  for (let i = 0; i < openModalCreateBtns.length; i++) {
    openModalCreateBtns[i].onclick = function() {
      taskCreateOrEditBtn.innerHTML = "create card".toLowerCase().trim();
      var taskCreateInput = document.getElementById("taskCreateInput");
      taskCreateInput.value = "";

      // here we need also to de-select all categories options:
      let catSelectEl = document.getElementById("categoriesSel");
      let chilsOfSelect = catSelectEl.childNodes;
      for (let i = 0; i < chilsOfSelect.length; i++) {
        chilsOfSelect[i].selected = false;
      } 

      modal.dataset.containerId = openModalCreateBtns[i].parentNode.id;
      modal.dataset.flag = "create";
      modal.style.display = "block";
    }
  }

  addCreateOrEditCardOnClick(taskCreateOrEditBtn, modal);

  // When the user clicks on (x), close the modal
  iconClose.onclick = function() {
    modal.style.display = "none";
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  } 
}

// add delete onclick to all delTaskBtn:
function handleTaskDelete() {
  const delTaskBtns = document.querySelectorAll(".delTaskBtn");
  delTaskBtns.forEach(async delTaskBtn => {
    await addDeleteCardOnclick(delTaskBtn);
  });
}

// delete btn in draggable:
async function addDeleteCardOnclick(delTaskBtn) {
  delTaskBtn.onclick = async function() {
    let graggable = delTaskBtn.parentNode;
    // here we should get categories names before the
    // delete, cause will not work after:
    let categoriesNames = await getCategoriesNamesByTaskId(graggable.id);
    await deleteCard(graggable.id);
    let containerId = graggable.parentNode.id;
    await updateBarChart(containerId, "-");
    await updateLineChart(containerId, "-");
    updatePolarChart(categoriesNames, "-");
    graggable.remove();
  }
}

// edit btn in draggable:
async function addEditCardOnclick(editTaskI) {
  editTaskI.onclick = async function() {
    // we need to change some data in modal:
    var taskCreateOrEditBtn = document.getElementById("taskCreateOrEditBtn");
    taskCreateOrEditBtn.innerHTML = "update card".toLowerCase().trim();

    // get current draggable:
    let graggable = editTaskI.parentNode;
    // this is text of card, we need to set it to modal textarea:
    let cardTxt = graggable.childNodes[0].innerHTML;
    var taskCreateInput = document.getElementById("taskCreateInput");
    taskCreateInput.value = cardTxt;

    // we also need to get categories names by card_id:
    let categoriesNames = await getCategoriesNamesByTaskId(graggable.id);
    // here we need also to re-select all categories options:
    let catSelectEl = document.getElementById("categoriesSel");
    let chilsOfSelect = catSelectEl.childNodes;
    for (let i = 0; i < chilsOfSelect.length; i++) {
      let aNode = chilsOfSelect[i];
      if (aNode.nodeType === Node.ELEMENT_NODE) {
        if (categoriesNames.includes(aNode.innerHTML.trim().toLowerCase())) {
          aNode.selected = true;
        }
        else {
          aNode.selected = false;
        }
      }
    } 

    var modal = document.getElementById("myModal");
    modal.dataset.editedTaskId = graggable.id;
    modal.dataset.cetegoriesNamesBeforeEdit = categoriesNames;
    modal.dataset.flag = "edit";
    modal.style.display = "block";
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
      await updateCard(draggedElement.id, null, container.id, null);
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
      draggable.childNodes[0].nodeType === Node.ELEMENT_NODE, "nodeType should be ELEMENT");
    await updateCard(draggable.id, draggable.childNodes[0].textContent, null, null);
  });
}

function clearAllDraggableDivs() {
  var draggables = document.getElementsByClassName('draggable');

  while(draggables[0]) {
    draggables[0].parentNode.removeChild(draggables[0]);
  }
}

async function getAndSetContainersIdsAndNames(currentDate) {
  await invoke(
    'try_to_create_date_and_containers',
    { currentDateStr: currentDate }).then((containersFromRust) => {
      if (containersFromRust.length > 0) {
        let containers = document.getElementsByClassName("container");
        console.assert(containers.length === 3, "containers.length should be 3");
        console.assert(
          containersFromRust.length === containers.length,
          "containersFromRust.length should be === containers.length"
        );

        // replace containers id's and name:
        for (let i = 0; i < containersFromRust.length; i++) {
          containers[i].id = containersFromRust[i].id;
          // todo: why were here have first node - TEXT_NODE?
          console.assert(
            containers[i].childNodes[0].nodeType === Node.TEXT_NODE,
            "ERROR: wrong first node type in container"
          );
          console.assert(
            containers[i].childNodes[1].nodeType === Node.ELEMENT_NODE,
            "ERROR: wrong second node type in container"
          );
          containers[i].childNodes[1].innerHTML = containersFromRust[i].status;
        }
      }
  });
}

async function handleArrowClick() {
  clearAllDraggableDivs();
  let currentDate = dateMsgEl.textContent;
  await getAndSetContainersIdsAndNames(currentDate);
  getCards(currentDate);
}

function prependToLineChart() {
  if (lineChart !== undefined) {
    let currDate = dateMsgEl.textContent.toLowerCase().trim();
    if (!lineChart.data.labels.includes(currDate)) {
      lineChart.data.labels.unshift(currDate);
      for (let i = 0; i < lineChart.data.datasets.length; i++) {
        lineChart.data.datasets[i].data.unshift(0);
      };
    };
  }
  else {
    console.assert(false, "ERROR in prependToLineChart: lineChart is undefined");
  }
}

function appendToLineChart() {
  if (lineChart !== undefined) {
    let currDate = dateMsgEl.textContent.toLowerCase().trim();
    if (!lineChart.data.labels.includes(currDate)) {
      lineChart.data.labels.push(currDate);
      for (let i = 0; i < lineChart.data.datasets.length; i++) {
        lineChart.data.datasets[i].data.push(0);
      };
    };
  }
  else {
    console.assert(false, "ERROR in appendToLineChart: lineChart is undefined");
  }
}

function handleArrows() {
  var leftArrow = document.getElementById("leftArrow");
  var rightArrow = document.getElementById("rightArrow");

  // When the user clicks on this arrow, go back:
  leftArrow.onclick = async function() {
    await getAndSetPrevOrNextDate("left");
    await handleArrowClick();
    prependToLineChart();
  }

  // When the user clicks on this arrow, go forward:
  rightArrow.onclick = async function() {
    await getAndSetPrevOrNextDate("right");
    await handleArrowClick();
    appendToLineChart();
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
          if (barChart.data.labels[i].toLowerCase().trim() === containerStatus.toLowerCase().trim()) {
            if (flag === "+") {
              dataset.data[i] += 1
            } else if (flag === "-") {
              dataset.data[i] -= 1
            }
            else {
              console.assert(false, `Error: strange flag, ${flag}`);
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
    let someCurrDate = stats[i]["date"].toLowerCase().trim();
    if (!labels.includes(someCurrDate)) {
      labels.push(someCurrDate);
    };
    for (let j = 0; j < datasets.length; j++) {
      if (stats[i]["status"].toLowerCase().trim() === datasets[j].label.toLowerCase().trim()) {
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
      let currDate = dateMsgEl.textContent.toLowerCase().trim();

      // first find labels index (right date):
      for (let i = 0; i < lineChart.data.labels.length; i++) {
        if (lineChart.data.labels[i].toLowerCase().trim() === currDate) {
          dateIndex = i;
          break;
        };
      };

      if (dateIndex === undefined) {
        console.assert(
          false,
          `ERROR: something went very wrong in updateLineChart - dateIndex is ${dateIndex}`
        );
      }

      // then iterate over all datasets to find right status dataset:
      for (let j = 0; j < lineChart.data.datasets.length; j++) {
        if (lineChart.data.datasets[j].label.toLowerCase().trim() === containerStatus.toLowerCase().trim()) {
          if (dateIndex >= lineChart.data.datasets[j].data.length) {
            console.assert(false, `Error: dateIndex ${dateIndex} is >= then ${lineChart.data.datasets[j].data.length}`);
          }
          else {
            if (flag === "+") {
              lineChart.data.datasets[j].data[dateIndex] += 1;
            } 
            else if (flag === "-") {
              if (lineChart.data.datasets[j].data[dateIndex] === 0) {
                console.assert(
                  false,
                  `Error: this ${lineChart.data.datasets[j].data.label} array element with index ${dateIndex} is already 0! You are dumb`
                );
              }
              lineChart.data.datasets[j].data[dateIndex] -= 1;
            } 
            else {
              console.assert(false, `Error: strange flag, ${flag} or flaw in logic`);
            }
            break;
          }
        }
      };
      lineChart.update();
  });
}

async function setCategoriesOptions() {
  let cats = await invoke('get_categories');
  let catSelectEl = document.getElementById("categoriesSel");
  for (let i = 0; i < cats.length; i++) {
    const newOption = document.createElement("option");
    newOption.setAttribute("value", cats[i][0]);
    newOption.innerHTML = cats[i][1];
    catSelectEl.appendChild(newOption);
  };
};

function getRandomInt() {
  return Math.floor(Math.random() * 255);
}

async function drawPolarChart() {
  let stats = await invoke("get_stats_4_polar");

  let labels = [];
  let adata = [];
  let backgroundColor = [];

  for (let i = 0; i < stats.length; i++) {
    labels.push(stats[i]["name"]);
    adata.push(stats[i]["count"]);
    let red = getRandomInt();
    let green = getRandomInt();
    let blue = getRandomInt();
    backgroundColor.push(`rgb(${red}, ${green}, ${blue})`);
  }

  const ctx = document.getElementById('polarChart');
  polarChart = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: labels,
      datasets: [{
        label: '# of Tasks by categories:',
        data: adata,
        borderWidth: 1,
        backgroundColor: backgroundColor
      }]
    },
    options: {
    }
  });
}

async function getCategoriesNamesByTaskId(cardId) {
  return await invoke(
    'get_categories_names_by_task_id',
    { cardId: parseInt(cardId) }).then((categoriesNames) => {
      return categoriesNames;
  });
}

function updatePolarChart(categoriesNames, flag) {
  for (let i = 0; i < categoriesNames.length; i++) {
    let categoryName = categoriesNames[i].toLowerCase().trim();
    let categoryNameIndex = polarChart.data.labels.indexOf(categoryName);
    if (categoryNameIndex === -1 && flag === "-") {
      console.assert(
        false,
        `ERROR: no such categoryName ${categoryName} in polarChart! Flag is ${flag}`
      );
    }
    // This case is indeed possible (we added new card with new category)
    else if (categoryNameIndex === -1 && flag === "+") {
      polarChart.data.labels.push(categoryName);
      polarChart.data.datasets[0].data.push(1);
      let red = getRandomInt();
      let green = getRandomInt();
      let blue = getRandomInt();
      polarChart.data.datasets[0].backgroundColor.push(`rgb(${red}, ${green}, ${blue})`);
    }
    else {
      if (flag === "+") {
        polarChart.data.datasets[0].data[categoryNameIndex] += 1
      }
      else if (flag === "-") {
        polarChart.data.datasets[0].data[categoryNameIndex] -= 1
      }
      else {
        console.assert(false, `Error: strange flag in updatePolarChart, ${flag}`);
      }
    };
  };

  polarChart.update();
}

window.addEventListener("DOMContentLoaded", async () => {
  dateMsgEl = document.querySelector("#date-msg");

  await initGetDate();
  await getAndSetContainersIdsAndNames(dateMsgEl.textContent);
  await getCards(dateMsgEl.textContent);
  handleTaskDelete();
  handleModal();
  handleDragging();
  handleArrows();
  await setCategoriesOptions();

  await drawBarChart();
  await drawLineChart();
  await drawPolarChart();
  
});


