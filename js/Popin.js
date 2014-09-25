function createPopin(html, position){
    var elem = document.createElement('div');
    document.body.appendChild(elem);
    elem.className = 'popin';
    elem.style.display = 'block';
    if (position){
        elem.style.left = position.x;
        elem.style.top  = position.y;
    }
    var close = document.createElement('img');
    elem.appendChild(close);
    close.className = "btn_close";
    close.onclick = function(obj){ 
        document.body.removeChild(elem);
    };
    close.src = "images/close.png";
    close.height = 32;
    close.width = 32;

    if (html){
        var text = document.createElement('div');
        elem.appendChild(text);
        text.innerHTML = html;
    }

    return elem;
}
