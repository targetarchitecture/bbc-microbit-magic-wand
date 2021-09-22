function CircularBuffer(max) {
  var list = [];
  var end = 0;
  var start = 0;

  this.push = function (item) {
    if (end - start >= max) {
      start++;
      if (start >= max) {
        start = 0;
        end = max - 1;
      }
    }
    var index = end % max;
    list[index] = item;

    end++;
  };

  this.toArray = function () {
    var first = list.slice(start, Math.min(end, max));
    var second = list.slice(0, Math.max(end - max, 0));

    return first.concat(second);
  };

}

//https://softwarepatterns.com/ring-buffer