const Dialog = require('jsfreemaplib').Dialog;

class PhotoManager {

    constructor(nrows, ncols, photodiv, options) {
        this.selectedPhoto = 0;
        this.positionedPhotos = {};
        this.userPhotos = [];
        this.nrows = nrows;
        this.ncols = ncols;
        this.currentPage = 0;
        this.curPos = null;
        this.options = options || {};
        this.options.adminProvider = this.options.adminProvider || { isadmin: 0 };
        this.table = document.createElement("table");
        this.table.style.marginLeft = 'auto';
        this.table.style.marginRight = 'auto';

        this.endpoints = {
            'mine': 'panorama/mine',
            'unauthorised' : 'panorama/unauthorised',
            'unpositioned' : 'panorama/unpositioned'
        };

        const upload = document.createElement('input');
        upload.type = 'button';
        upload.value = 'Save positioned photos';
        upload.id='_uploadPositionedPhotos';
        upload.disabled = true; 
        upload.addEventListener('click', this.uploadPositionedPhotos.bind(this)); 
        options.actionsContainer.appendChild(upload);

        this.controlsDiv = document.createElement('div');
        const rewindBtn = document.createElement('a');
        rewindBtn.href='#';
        rewindBtn.id = '_rewindBtn';
        rewindBtn.appendChild(document.createTextNode('<<'));
        rewindBtn.addEventListener('click', this.displayCurrentPage.bind(this, 0));
        rewindBtn.style.display = 'none';
        this.controlsDiv.appendChild(rewindBtn);
        this.controlsDiv.appendChild(document.createTextNode(" "));

        const backBtn = document.createElement('a');
        backBtn.href='#';
        backBtn.id = '_backBtn';
        backBtn.appendChild(document.createTextNode('<'));
        backBtn.addEventListener('click', this.displayPreviousPage.bind(this));
        backBtn.style.display = 'none';
        this.controlsDiv.appendChild(backBtn);
        this.controlsDiv.appendChild(document.createTextNode(" "));

        this.pageNavigation = document.createElement('span');
        this.controlsDiv.appendChild(this.pageNavigation);

        const nextBtn = document.createElement('a');
        nextBtn.href='#';
        nextBtn.id = '_nextBtn';
        nextBtn.appendChild(document.createTextNode('>'));
        nextBtn.addEventListener('click', this.displayNextPage.bind(this));
        nextBtn.style.display = 'none';
        this.controlsDiv.appendChild(nextBtn);
        this.controlsDiv.appendChild(document.createTextNode(" "));

        const fastForwardBtn = document.createElement('a');
        fastForwardBtn.href='#';
        fastForwardBtn.id = '_fastForwardBtn';
        fastForwardBtn.appendChild(document.createTextNode('>>'));
        fastForwardBtn.addEventListener('click', this.displayLastPage.bind(this));
        fastForwardBtn.style.display = 'none';
        this.controlsDiv.appendChild(fastForwardBtn);


        const status = document.createElement("div");
        status.classList.add("error");
        status.id = "_photoMgrStatus";
        document.getElementById(photodiv).appendChild(status);

        this.select = document.createElement("select"); 
        this.select.id = '_panoSelectionModes';


        document.getElementById(photodiv).appendChild(this.select);
        document.getElementById(photodiv).appendChild(this.table);
        document.getElementById(photodiv).appendChild(this.controlsDiv);
        this.reloadModeSelect();
        this.loadPanosByCurrentCriterion();
        this.select.addEventListener("change", e=> {
            this.loadPanosByCriterion(e.target.value)
        });
    }

    reloadModeSelect() {
        this.select.innerHTML = "";

        const  modeVals = { 
                            "mine": "My panoramas",
                           "unpositioned": "My unpositioned panoramas" 
                        };
        for(let k in modeVals) {
            let option = document.createElement("option");
            option.value = k;
            option.appendChild(document.createTextNode(modeVals[k]));
            this.select.appendChild(option);
        }


        if(this.options.adminProvider.isadmin == 1) {
            const option = document.createElement("option");
            option.value = 'unauthorised';
            option.appendChild(document.createTextNode('Unauthorised panoramas'));
            this.select.appendChild(option);

        }
    }    

    setCoords(latlng) {
        if(this.selectedPhoto> 0) {
            this.curPos = latlng;
            this.latLonUpdated();
        } 
    }

    latLonUpdated() { 
        document.getElementById(`img${this.selectedPhoto}`).style.border='5px solid red';
        this.positionPhoto(this.selectedPhoto, this.curPos.lat, this.curPos.lng);
        this.curPos = null;
    }
    
    positionPhoto(id, lat, lon) {
        document.getElementById('_uploadPositionedPhotos').disabled = false;
        this.positionedPhotos[id] = {'lat': lat, 'lon': lon};
        document.getElementById('lat'+id).innerHTML = 'Lat: '+lat.toFixed(4) + ', ';
        document.getElementById('lon'+id).innerHTML = 'Lon: '+lon.toFixed(4) + ' ';
        if(this.options.onPositioned) {
            this.options.onPositioned(id, lat, lon);
        }
    }

    uploadPositionedPhotos() {
        const ids = Object.keys(this.positionedPhotos);
        if(ids.length > 0) {    
            const panoData = ids.map (id => {
                return {
                    id: id,
                    lat: this.positionedPhotos[id].lat,
                    lon: this.positionedPhotos[id].lon
                }
            });

            fetch(`/panorama/moveMulti`,
                                { body: JSON.stringify({panos: panoData}),
                                headers: { 'Content-Type': 'application/json'},
                                method:'POST'}).
                                then(response=>response.json()).
                                then(successful=>{ 
                                    this.positionedPhotos = {};
                                    this.status(`Successfully uploaded ${successful.moved.length} positions.`);
                                    document.getElementById('_uploadPositionedPhotos').disabled = true;
                                    this.loadPanosByCriterion(document.getElementById('_panoSelectionModes').value);
                                    if(this.options.onPositionUploaded) {
                                        this.options.onPositionUploaded();
                                    }
                                });
            
        }    
    }

    photoClick(e) {
        this.removeSelected();
        e.target.style.borderColor='red';    
        const id = e.target.id.substr(3);
        this.selectedPhoto = id; 
        if(this.options.onSelected) {
            this.options.onSelected(id);
        }
    } 

    removeSelected() {
        if(this.selectedPhoto > 0) {
            const el=document.getElementById('img'+this.selectedPhoto);
            if(el) {
                el.style.borderColor='black';
                this.selectedPhoto = 0;
            }
        }
    }

    loadPanosByCurrentCriterion() {
        this.loadPanosByCriterion(this.select.value);
    }

    loadPanosByCriterion(criterion) {
        fetch(this.endpoints[criterion]).then(resp=> {
                if(resp.status==200) {
                    return resp.json();
                } else if (resp.status==401) {
                    throw new Error('Your session has timed out. Please log in again.');
                }
            }).then(data => {
            this.userPhotos = data;
            this.nPages = 1+Math.floor((this.userPhotos.length-1) / (this.nrows * this.ncols));
            this.pageNavigation.innerHTML = '';
            this.displayCurrentPage(0);
            document.getElementById('_rewindBtn').style.display = this.nPages > 0 ? 'inline': 'none';
            document.getElementById('_fastForwardBtn').style.display = this.nPages > 0 ? 'inline': 'none';
        }); //.catch(e => this.status(e));
    }

    displayCurrentPage(pg) {
        this.currentPage=pg;
        this.doDisplayCurrentPage();
    }

    doDisplayCurrentPage(criterion) {
        if(this.nPages > 0) {
            this.setupPageLinks();
        }
        this.table.innerHTML =  "";
        let startIdx = this.currentPage * this.nrows * this.ncols;
        const useRawUploads = ['unauthorised', 'unpositioned'].indexOf(this.select.value) > -1;
        for(let trow=0; trow<this.nrows; trow++) {
            let tr = document.createElement("tr");
            for(let tcol=0; tcol<this.ncols; tcol++) {
                let curIdx = startIdx + (trow*this.ncols+tcol);
                if(curIdx < this.userPhotos.length) {
                    let id = this.userPhotos[curIdx].id;
                    if(this.userPhotos[curIdx].lat && this.userPhotos[curIdx].lon) {
                        // TODO make sure that shows lat/lon
                    }

                    let isSelected=false;
                    let angle=null;
                    if(this.selectedPhoto==id) {
                        isSelected=true;
                    }

                    let td=document.createElement("td");
                    td.id = `td${id}`;
                    let div = document.createElement("div");
                    let img = document.createElement("img");
                    img.setAttribute("class", "photo");
                    img.id = `img${id}`;
                    img.style.border = '5px solid ' +(isSelected?'red':'black');
                    img.src =  useRawUploads ? `panorama/${id}.r200.rawupload.jpg`: `panorama/${id}.r200.jpg`;
                    img.alt = `pano ${id}`;
                    div.appendChild(img);
                    td.appendChild(div);
                    let idDisplay = document.createElement("strong");
                    idDisplay.innerHTML = `#${id}: `;
                    td.appendChild(idDisplay);
                    let spanLat = document.createElement("span");
                    spanLat.id=`lat${id}`;
                    spanLat.appendChild(document.createTextNode(`Lat ${this.positionedPhotos[id] ? this.positionedPhotos[id].lat.toFixed(4) : (this.userPhotos[curIdx].lat  ? parseFloat(this.userPhotos[curIdx].lat).toFixed(4) : "?")}`));
                    td.appendChild(spanLat);
                    td.appendChild(document.createTextNode(", "));
                    let spanLon = document.createElement("span");
                    spanLon.id=`lon${id}`;
                    spanLon.appendChild(document.createTextNode(`Lon ${this.positionedPhotos[id] ? this.positionedPhotos[id].lon.toFixed(4) : (this.userPhotos[curIdx].lon ? parseFloat(this.userPhotos[curIdx].lon).toFixed(4) :  "?")}`));
                    td.appendChild(spanLon);
                    td.appendChild(document.createElement("br"));
                    const aLargePano = document.createElement('a');
                    aLargePano.href='#';
                    aLargePano.appendChild(document.createTextNode("View"));
                    aLargePano.addEventListener("click", e => {
                        if(!this.largePanoDlg) {    
                            this.largePanoDlg = new Dialog(document.body,
                            { 'Close': ()=> { this.largePanoDlg.hide(); this.largePanoDlg = null; }},
                            {
                                backgroundColor: '#e0ffe0', 
                                border: '5px solid black',
                                color: "black",
                                textAlign: "center",
                                width:'80%',
                                height:'80%',
                                top: '5%',
                                left: '10%',
                                zIndex: 99999 
                            });
                            this.largePanoDlg.div.id = 'dlgLargePano';
                            const imgfile = useRawUploads ? `/panorama/${id}.rawupload.jpg` : `/panorama/${id}.jpg`;
                            this.largePanoDlg.setContent(`<h2>Panorama #${id}</h2><div style='padding: 10px; width: auto; height: 80%; overflow: auto'><img src='${imgfile}' /></div>`);
                            this.largePanoDlg.show();
                        }
                    });
                    td.appendChild(aLargePano);

                    if(this.options.adminProvider.isadmin == 1 && this.userPhotos[curIdx].authorised === 0) {
                        let aAuth = document.createElement('a');
                        aAuth.href='#';
                        aAuth.appendChild(document.createTextNode('Authorise'));
                        aAuth.addEventListener('click', (function(curIdx) {
                            this.status('Authorising...');
                            let id = this.userPhotos[curIdx].id;
                            fetch(`panorama/${id}/authorise`, { method: 'POST' }).then( response => { 
                                try {
                                if(response.status==200) {
                                    this.status(`Pano ${id} authorised successfully.`);
                                    this.userPhotos.splice(curIdx, 1);
                                    this.doDisplayCurrentPage();
                                } else {
                                    this.status(`Server error: code ${response.status}`);
                                }
                                } catch(e) { console.log(`ERROR: ${e}`) }
                            }).catch(e => { alert(e); });
                        }).bind(this, curIdx));
                        td.appendChild(document.createTextNode(" | "));
                        td.appendChild(aAuth);
                    }
                    let aDelete = document.createElement('a');
                    aDelete.href='#';
                    aDelete.appendChild(document.createTextNode('Delete'));
                    aDelete.addEventListener('click', (function(curIdx) {
                        this.status('Deleting...');
                        let id = this.userPhotos[curIdx].id;
                        fetch(`panorama/${id}`, { method: 'DELETE' }).then( response=> {
                            if(response.status==200) {
                                this.status(`Pano ${id} deleted.`);
                                this.userPhotos.splice(curIdx, 1);
                                this.doDisplayCurrentPage();
                            } else {
                                this.status(`Server error: code ${response.status}`);
                            }
                        }).catch(e => { alert(e); } );
                    }).bind(this, curIdx));
                    td.appendChild(document.createTextNode(" | "));
                    td.appendChild(aDelete);

                    tr.appendChild(td);
                  } 
            }
            this.table.appendChild(tr);
        }


        document.getElementById('_backBtn').style.display = (this.currentPage>0 ? 'inline': 'none');
        
        document.getElementById('_nextBtn').style.display = (this.currentPage < this.nPages-1) ? 'inline': 'none';  
        this.setupEvents();
    }

    displayPreviousPage() {
        this.displayCurrentPage(this.currentPage-1);
    }

    displayNextPage() {
        this.displayCurrentPage(this.currentPage+1);
    }

    displayLastPage() {
        this.displayCurrentPage(this.nPages - 1);
    }

    setupEvents() {
        let allPhotos = document.querySelectorAll('.photo');
        for(let i=0; i<allPhotos.length; i++) {
            allPhotos[i].addEventListener("click", this.photoClick.bind(this));
        }
    }

    setupPageLinks() {
        this.pageNavigation.innerHTML = '';
        const inclNPages = 10;
        let pageArray = new Array(inclNPages).fill().map( (val,idx)=> idx + Math.min(this.currentPage,this.nPages - inclNPages)).filter( val => val >= 0 && val < this.nPages);
        for(let i of pageArray) {
            const a = document.createElement('a');
            if(i == this.currentPage) {
                a.style.fontWeight = 'bold';
            }
            a.href='#';
            a.appendChild(document.createTextNode(i+1));
            a.addEventListener("click", this.displayCurrentPage.bind(this, i));
            this.pageNavigation.appendChild(a);
            this.pageNavigation.appendChild(document.createTextNode(" "));
        }
    }

    status(msg) {
        document.getElementById('_photoMgrStatus').innerHTML = msg;
    } 
}

export default PhotoManager;
