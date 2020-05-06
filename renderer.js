// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const { ipcRenderer, remote } = require("electron");
const isDevelopment = require("electron-is-dev");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const truckSimTelemetry = require("trucksim-telemetry");

const baseUrl = "https://next-generation-tracker.herokuapp.com/";
const telemetry = truckSimTelemetry();

let config = {};
let configPath = "";
let userData = {};
let topSpeed = 0;
let jobData = {};
let isLate = false;
let gameId = "";
let loggedIn = false;

function initFormChangeBtns() {
  console.info("initFormChangeBtns");
  $("#changeToRegisterBtn").on("click", () => {
    $("#loginForm").fadeOut("fast", () => {
      $("#registerForm").fadeIn("fast");
    });
  });

  $("#changeToLoginBtn").on("click", () => {
    $("#registerForm").fadeOut("fast", () => {
      $("#loginForm").fadeIn("fast");
    });
  });
}

function initBackgroundImages() {
  console.info("initBackgroundImages");
  let files = fs.readdirSync(path.join(__dirname, "images", "background"));
  let firstImage = true;

  files.forEach((image) => {
    if (firstImage) {
      $("#carouselData").prepend(
        '<div class="carousel-item active"><img src="images/background/' +
          image +
          '" alt="' +
          image +
          '"/></div>'
      );
      firstImage = false;
    } else {
      $("#carouselData").prepend(
        '<div class="carousel-item"><img src="images/background/' +
          image +
          '" alt="' +
          image +
          '"/></div>'
      );
    }
  });
}

function readConfig() {
  console.info("readConfig");
  if (!fs.existsSync(configPath)) {
    fs.appendFile(configPath, "{}", (err) => {
      if (err) throw err;
      console.log("Created config file");
    });
  }

  fs.readFile(configPath, (err, data) => {
    if (err) throw err;
    config = JSON.parse(data);
    if (config.rememberMe) {
      getUserData();
    } else {
      $("#loadingAnimImg").fadeOut(100);
      $("#loginForm").fadeIn("fast");
    }
  });

  if (
    fs.existsSync(path.join(remote.app.getPath("userData"), "userData.json"))
  ) {
    fs.readFile(
      path.join(remote.app.getPath("userData"), "userData.json"),
      (err, data) => {
        if (err) throw err;
        if (data) {
          userData = JSON.parse(data);
          $("#loginInput").val(userData.email);
        }
      }
    );
  }
}

function goToDashboard() {
  console.info("goToDashboard");
  $("#accountForms").fadeOut("fast", () => {
    $("#mainBody").fadeIn("fast");
  });
}

function getUserData() {
  console.info("getUserData");
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${config.token}`);
  fetch(`${baseUrl}api/users/self`, { headers: headers })
    .then((res) => res.json())
    .then((data) => {
      if (data !== undefined) {
        loggedIn = true;
        console.log(data);
        userData = data;
        updateUserDataDisplay();
        saveUserData();
        goToDashboard();
        telemetry.watch();
        $("#loadingAnimImg").fadeOut(100);
      } else {
        $("#loadingAnimImg").fadeOut(100);
        $("#loginForm").fadeIn("fast");
      }
    })
    .catch((err) => {
      console.error(err);
      $("#loginForm").fadeIn("fast");
      $("#loadingAnimImg").fadeOut(100);
      switch (err.errno) {
        case "ECONNREFUSED":
          $("#loginFormErrorText").text("Couldn't connect to the server");
          break;

        default:
          $("#loginFormErrorText").text("Unknown error");
          break;
      }
    });
}

function initAccountActionBtns() {
  $("#loginBtn").click(loginUser);
  $("#registerBtn").click(registerUser);
}

function saveConfig() {
  fs.writeFile(configPath, JSON.stringify(config), (err) => {
    if (err) throw err;
    console.log("Saved config");
  });
}

function saveUserData() {
  fs.writeFile(
    path.join(remote.app.getPath("userData"), "userData.json"),
    JSON.stringify(userData),
    (err) => {
      if (err) throw err;
      console.log("Saved userData");
    }
  );
}

function loginUser() {
  console.info("loginUser");
  $("#loginFormErrorText").html("");
  let loginObject = {
    login: $("#loginInput").val(),
    password: $("#passwordInput").val(),
    rememberMe: $("#rememberMeCheckbox").prop("checked"),
  };
  let errorStr = "";
  if (!loginObject.login) {
    errorStr += "Missing email/username<br/>";
  }
  if (!loginObject.password) {
    errorStr += "Missing password<br/>";
  }
  if (errorStr) {
    $("#loginFormErrorText").html(errorStr);
    return;
  }
  $("#loginBtn").attr("disabled", true);
  $("#loginSpinner").css("display", "");

  fetch(`${baseUrl}api/auth/login`, {
    method: "post",
    body: JSON.stringify(loginObject),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => {
      console.log(res);
      return res.json();
    })
    .then((json) => {
      console.log(json);
      if (json.success) {
        config.rememberMe = loginObject.rememberMe;
        config.token = json.data;
        saveConfig();
        getUserData();
      } else {
        $("#loginBtn").attr("disabled", false);
        $("#loginSpinner").css("display", "none");
        $("#loginFormErrorText").html(json.message);
      }
    })
    .catch((err) => {
      console.error(err);
      switch (err.errno) {
        case "ECONNREFUSED":
          $("#loginFormErrorText").text("Couldn't connect to the server");
          break;

        default:
          $("#loginFormErrorText").text("Unknown error");
          break;
      }
      $("#loginBtn").attr("disabled", false);
      $("#loginSpinner").css("display", "none");
    });
}

function registerUser() {
  console.info("registerUser");
  $("#registerFormErrorText").html("");
  let registerObject = {
    username: $("#usernameInput").val(),
    email: $("#emailInput").val(),
    password: $("#registerPasswordInput").val(),
  };
  let errorStr = "";
  if (!registerObject.username) {
    errorStr += "Missing username<br/>";
  }
  if (!registerObject.email) {
    errorStr += "Missing email<br/>";
  }
  if (!registerObject.password) {
    errorStr += "Missing password<br/>";
  }
  if (registerObject.password !== $("#confirmPasswordInput").val()) {
    errorStr += "Passwords don't match<br/>";
  }
  if (errorStr) {
    $("#registerFormErrorText").html(errorStr);
    return;
  }
  $("#registerBtn").attr("disabled", true);
  $("#registerSpinner").css("display", "");

  fetch(`${baseUrl}api/auth/register`, {
    method: "post",
    body: JSON.stringify(registerObject),
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((json) => {
      if (json.success) {
        $("#loginInput").val(registerObject.email);
        $("#passwordInput").val(registerObject.password);
        $("#rememberMeCheckbox").prop("checked", true);
        $("#registerForm").fadeOut("fast", () => {
          $("#loginForm").fadeIn("fast");
        });
        loginUser();
      } else {
        $("#registerFormErrorText").html(`${json.message}<br/>`);
        $("#registerBtn").attr("disabled", false);
        $("#registerSpinner").css("display", "none");
      }
    })
    .catch((err) => {
      console.error(err);
      switch (err.errno) {
        case "ECONNREFUSED":
          $("#registerFormErrorText").text("Couldn't connect to the server");
          break;

        default:
          $("#registerFormErrorText").text("Unknown error");
          break;
      }
      $("#registerBtn").attr("disabled", false);
      $("#registerSpinner").css("display", "none");
    });
}

function updateUserDataDisplay() {
  //$("#userAvatar").attr("src");
  $("#usernameSpan").text(userData.username);
  $("#jobsCompletedSpan").text(userData.jobsCompleted);
  $("#jobsCancelledSpan").text(userData.jobsCancelled);
  $("#totalMassTransportedSpan").text(userData.totalMassTransported);
  $("#totalMoneyEarnedSpan").text(userData.totalMoneyEarned);
  $("#topSpeedSpan").text(userData.topSpeed);
  $("#totalDistanceSpan").text(userData.totalDistance);
}

function sendJobData(job, finished) {
  if (!loggedIn) return;
  let postObject = {};
  postObject.isLate = isLate;
  postObject.wasFinished = finished;
  postObject.gameId = gameId;
  postObject.sourceCityId = job.source.city.id;
  postObject.sourceCompanyId = job.source.company.id;
  postObject.destinationCityId = job.destination.city.id;
  postObject.destinationCompanyId = job.destination.company.id;
  postObject.cargoId = job.cargo.id;
  postObject.topSpeed = topSpeed;
  postObject.income = job.income;
  postObject.mass = Math.round(job.cargo.mass);
  postObject.distanceDriven = job.plannedDistance.km;
  postObject.cargoDamage = job.cargo.damage;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${config.token}`);
  headers.set("Content-Type", "application/json");
  fetch(`${baseUrl}api/jobs`, {
    headers: headers,
    method: "post",
    body: JSON.stringify(postObject),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      refreshUserData();
    })
    .catch((err) => console.error(err));
  isLate = false;
  topSpeed = 0;
}

function refreshUserData() {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${config.token}`);
  fetch(`${baseUrl}api/users/self`, { headers: headers })
    .then((res) => res.json())
    .then((data) => {
      if (data !== undefined) {
        console.log(data);
        userData = data;
        updateUserDataDisplay();
        saveUserData();
      }
    })
    .catch((err) => console.error(err));
}

async function main() {
  if (isDevelopment) {
    // this is to give Chrome Debugger time to attach to the new window
    await new Promise((r) => setTimeout(r, 1000));
  }

  // breakpoints should work from here on,
  // toggle them with F9 or just use 'debugger'

  // await the document to finish loading
  await new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", resolve);
    } else {
      resolve();
    }
  });

  // notify Main that Renderer is ready
  ipcRenderer.send("rendererReady", null);

  // await confirmation that Main is ready
  await new Promise((resolve) => ipcRenderer.once("mainReady", resolve));

  $(() => {
    console.log("jQuery document ready");
    configPath = path.join(remote.app.getPath("userData"), "config.json");
    initBackgroundImages();
    initFormChangeBtns();
    initAccountActionBtns();
    readConfig();

    $(".loginFormInput").keypress(function (e) {
      if (e.which == 13) {
        $("#loginBtn").click();
        return false; //<---- Add this line
      }
    });

    $(".registerFormInput").keypress(function (e) {
      if (e.which == 13) {
        $("#registerBtn").click();
        return false; //<---- Add this line
      }
    });

    $("#logoutIcon").on("click", () => {
      telemetry.stop();
      config.rememberMe = false;
      saveConfig();
      ipcRenderer.send("restart");
    });

    telemetry.game.on("connected", () => {
      console.log("connected to telemetry");
      $("#sdkConnectionIcon").css("color", "green");
    });
    telemetry.game.on("disconnected", () => {
      console.log("disconnected from telemetry");
      $("#sdkConnectionIcon").css("color", "red");
    });
    telemetry.game.on("time-change", (current, previous) => {
      data = telemetry.getData();
      topSpeed = Math.max(topSpeed, data.truck.speed.value);
      jobData = data.job;
      if (current.value > data.job.deliveryTime.value) {
        isLate = true;
      }
      gameId = data.game.game.name;
    });

    telemetry.job.on("delivered", (deliveredObject) => {
      console.log("delivered");
      sendJobData(jobData, true);
    });
    telemetry.job.on("cancelled", (cancelledObject) => {
      console.log("cancelled");
      sendJobData(jobData, false);
    });
    telemetry.job.on("started", (startedObject) => {
      isLate = false;
      topSpeed = 0;
    });
  });
}

main().catch((error) => {
  console.log(error);
  alert(error);
});
