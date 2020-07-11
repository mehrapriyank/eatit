
exports.getDate = function(date){
  const today = new Date(date);
  const options = { weekday: 'long',
  day: 'numeric',
  month: 'long'
  };
  const day = today.toLocaleDateString("en-US", options);

  return day;
}

exports.getDateFull = function(date){
  const today = new Date(date);
  const options = { weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
  };
  const day = today.toLocaleDateString("en-US", options);

  return day;
}

exports.addDays = function(date, days){
  date.setDate(date.getDate() + days);
  return date;
}

exports.remainingDays = function(oldDate){
  const t = new Date();
  const diff = oldDate.getTime()-t.getTime();
  const Difference_In_Days = Math.round(diff / (1000 * 3600 * 24)) ;
  return Difference_In_Days;

}
