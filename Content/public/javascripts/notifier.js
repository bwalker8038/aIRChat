(function($){

  var config = window.NotifierjsConfig = {
    defaultTimeOut: 5000,
    position: ["top", "right"],
    notificationStyles: {
      padding: "12px 18px",
      margin: "0 0 6px 0",
      backgroundColor: "#34495E",
      opacity: 1,
      color: "#EEE",
      borderRadius: "3px",
      boxShadow: "#333 0 0 12px",
      width: "300px"
    },
    notificationStylesHover: {
      opacity: 1,
      boxShadow: "#222 0 0 12px"
    },
    container: $("<div></div>")
  };

  $(function() {
    config.container.css("position", "fixed");
    config.container.css("z-index", 9999);
    config.container.css(config.position[0], "50px");
    config.container.css(config.position[1], "12px");
    config.container.appendTo(document.body);
  });

  function getNotificationElement() {
    return $("<div>").css(config.notificationStyles).bind('hover', function() {
      $(this).css(config.notificationStylesHover);
    }, function() {
      $(this).css(config.notificationStyles);
    });
  }

  var Notifier = window.Notifier = {};

  Notifier.notify = function(message, title, iconUrl, timeOut) {
    var notificationElement = getNotificationElement();

    timeOut = timeOut || config.defaultTimeOut;

    if (iconUrl) {
      var iconElement = $("<img/>");
      iconElement.attr('src', iconUrl);
      iconElement.css({
        width: '36px',
        height: '36px',
        display: "inline-block",
        verticalAlign: "middle"
      });
      notificationElement.append(iconElement);
    }

    var textElement = $("<div/>").css({
      display: 'inline-block',
      verticalAlign: 'middle',
      padding: '0 12px'
    });

    if (title) {
      var titleElement = $("<div/>");
      titleElement.append(document.createTextNode(title));
      titleElement.css("font-weight", "bold");
      textElement.append(titleElement);
    }

    if (message) {
      var messageElement = $("<div/>");
      messageElement.append(document.createTextNode(message));
      textElement.append(messageElement);
    }

    setTimeout(function() {
      notificationElement.animate({ opacity: 0 }, 400, function(){
        notificationElement.remove();
      });
    }, timeOut);

    notificationElement.bind("click", function() {
      notificationElement.hide();
    });

    notificationElement.append(textElement);
    config.container.prepend(notificationElement);
  };

  Notifier.info = function(message, title) {
    Notifier.notify(message, title);
  };
  Notifier.warning = function(message, title) {
    Notifier.notify(message, title);
  };
  Notifier.error = function(message, title) {
    Notifier.notify(message, title);
  };
  Notifier.success = function(message, title) {
    Notifier.notify(message, title);
  };

}(jQuery));
