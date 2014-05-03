if (autoJoinServer && autoJoinChannel) {
  var favorites = stash.get('favorites');
  if (autoJoinChannel[0] !== '#') {
    autoJoinChannel = '#' + autoJoinChannel;
  }
  if (favorites /* exists */) {
    if (favorites[autoJoinServer] /* exists */) {
      var channels = favorites[autoJoinServer];
      if (channels.indexOf(autoJoinChannel) === -1) {
        favorites[autoJoinServer].push(autoJoinChannel);
      }
    } else {
      favorites[autoJoinServer] = [autoJoinChannel];
    }
  } else {
    favorites = {};
    favorites[autoJoinServer] = [autoJoinChannel];
  }
  stash.set('favorites', favorites);
  Notifier.info(
    'The channel ' + autoJoinChannel + ' on ' + autoJoinServer + 
    ' has been added to your favorites and you will be connected to it ' +
    'automatically when you log in.',
    'New Favorite Created'
  );
}
