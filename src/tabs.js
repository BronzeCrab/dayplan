window.addEventListener("DOMContentLoaded", () => {

  document.getElementById("days").style.display = "block";

  function openTab(clickedEl) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    let tabName = clickedEl.innerHTML.toLowerCase().trim();
    document.getElementById(tabName).style.display = "block";
    clickedEl.className += " active";
  }

  let tabBtns = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tabBtns.length; i++) {
      tabBtns[i].onclick = function() {
        openTab(tabBtns[i]);
    }
  }
});