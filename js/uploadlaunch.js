import Filterer from './filterer.js';
import Uploader from './uploader.js';

export default function() {
    const filterer = new Filterer(20.0);
    const uploader = new Uploader("panoUpload", "panoContainer",
                    { heading: "Upload panorama",
                    uploadLabel: "Agree and upload",
                    dialogDivId: 'dlgPanoUpload',
                    successMsg: 'Successfully uploaded. You will be able to view your panos but they will need to be approved by an administrator (1-2 days) for others to view them.',
                    content:
                        "<p>Panoramas should be 360 panoramas (either complete sphere or cylindrical) in equirectangular projection. Any non-panoramic photos or panoramas with sensitive content (e.g. faces, numberplates) may be deleted by site administrators. Panoramas should be on off-road routes; <strong>any panoramas on roads may be deleted by administrators to preserve space on the server.</strong> Panoramas will be copyright OpenTrailView 360 contributors and licenced under CC-BY 4.0. </p>"+
"<p>Please agree to this <strong>privacy policy:</strong>Your panoramas will be associated with your user account ID, or, if using your OpenStreetMap account, your OSM numerical user ID in the OpenTrailView database. The OpenTrailView API provides this information and thus it is possible to find out, via the API, which panoramas were contributed by which OSM users. The reason for associating panoramas with user ID is to allow you to view your own panoramas, and to allow you to modify your own panoramas, but not anyone else\'s.</p>",
                    style:
                        { 
                        top: '20px',
                        left: '25%',
                        width:'50%',
                        height:'calc(100% - 40px)',
                        border: '1px solid black',
                        padding: '10px',
                        backgroundColor: "#91c591",
                        zIndex: 9999,
                        color: "black" },
                        url: "panorama/upload",
                        additionalFormInput: {
                    },
                    additionalContent: "<input type='checkbox' id='snap' checked='true' /><label for='snap'>Snap panoramas to the nearest path on OpenStreetMap, if within 20m.</label><br /><input type='checkbox' id='roadcheck' /><label for='roadcheck'>Reject panoramas within 20m of a road, if the road is nearer than any path (RECOMMENDED).</label><br /><p><label for='filterDist'>Minimum distance between panoramas (panos closer than this will be filtered out):</label><br /><input type='range' id='filterDist' min='0' max='100' value='5' step='5' /><span id='filterDistValue'></span></p>",
                    onAddAdditionalContent: () => {
                        const range = document.getElementById('filterDist');
                        const roadcheck = document.getElementById('roadcheck');
                        const snap = document.getElementById('snap');
                        document.getElementById('filterDistValue').innerHTML = `${range.value}m`;
                        filterer.filterRoads = roadcheck.checked; 
                        filterer.snap = snap.checked;
                        range.addEventListener("change", e=> {
                            document.getElementById('filterDistValue').innerHTML = `${e.target.value}m`;
                            filterer.limit = parseFloat(e.target.value);
                        });
                        roadcheck.addEventListener("change", e=> { 
                            filterer.filterRoads = e.target.checked;
                        });
                        snap.addEventListener("change", e=> { 
                            filterer.snap = e.target.checked;
                        });
                    },
                    filterer: filterer.fullFilter.bind(filterer),
                    multiple: true
            });
                         
    filterer.setProgressHandler( msg => {
        uploader.setMessage(`<strong>FILTERING:</strong> ${msg}`); 
    });
    uploader.dialog.div.id = 'dlgPanoUpload';
    uploader.show();
}

