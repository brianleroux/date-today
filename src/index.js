// import the polyfill from node_modules
import CustomElements from 'webcomponents.js/CustomElements'

// define the class
class DateSpan extends HTMLSpanElement {
   createdCallback() {
     this.textContent = "Today's date: " + new Date().toJSON().slice(0, 10)
   }
}

// register the element w/ the DOM
let DateSpanElement = document.registerElement('date-today', DateSpan)

// export for other ppl to reuse!
export default DateSpanElement
