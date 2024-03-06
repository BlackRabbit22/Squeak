$("#signup").on("click", function () {
  let username = $("#signup-username").val();
  let password = $("#signup-password").val();

  let credentials = { username: username, password: password };

  $.post({
    url: "signup",
    data: JSON.stringify(credentials),
    contentType: "application/json",
    success: (res) => {
      $("#signup-username").removeClass("border-danger");
      $("#signup-password").removeClass("border-danger");
      $("#invalid-username").hide();
      $("#invalid-password").hide();

      switch (res) {
        case "invalid-username":
          $("#signup-username").addClass("border-danger");
          $("#invalid-username").show();
          break;
        case "invalid-password":
          $("#signup-password").addClass("border-danger");
          $("#invalid-password").show();
          break;
        case "valid":
          location.reload();
          break;
      }
    },
  });
});

$("#signin").on("click", function () {
  let username = $("#signin-username").val();
  let password = $("#signin-password").val();

  let credentials = { username: username, password: password };

  $.post({
    url: "signin",
    data: JSON.stringify(credentials),
    contentType: "application/json",
    success: (res) => {
      if (res) {
        location.reload();
      } else {
        $("#signin-username").addClass("border-danger");
        $("#signin-password").addClass("border-danger");
      }
    },
  });
});
