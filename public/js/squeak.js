$("#submit").on("click", function () {
  let squeak = $("#squeak").val();
  let token = $("#token").val();
  $.post({
    url: "squeak",
    data: { squeak: squeak, token: token },
    success: (res) => {
      if (res) {
        location.reload();
      } else {
        alert("You need to write a comment.");
      }
    },
  });
});

$("#signout").on("click", function () {
  let token = $("#token").val();
  $.post({
    url: "signout",
    data: { token: token },
  });
  location.reload();
});
