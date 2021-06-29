 function changebg(){
  var scrollvalue = window.scrollY;
  return console.log(scrollvalue);
}

window.addEventListener('scroll',changebg);

export default changebg;
