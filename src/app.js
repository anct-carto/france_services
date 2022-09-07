/*
    Annuaire cartographique France services v2.1
    Hassen Chougar / ANCT service cartographie
    dependances : Leaflet v1.0.7, vue v2.6.12, vue-router v4.0.5, bootstrap v4.6.0, papaparse v5.3.1

*/

// geocode
const api_adresse = "https://api-adresse.data.gouv.fr/search/?q=";
const api_admin = "https://geo.api.gouv.fr/departements?";

const loading = document.getElementById("loading");

const url = new URL(window.location.href);
const params = url.searchParams;
const qtype = params.get("qtype");

const data_url = "https://www.data.gouv.fr/fr/datasets/r/afc3f97f-0ef5-429b-bf16-7b7876d27cd4"
let fs_tab_fetched = [];
let page_status;


function init() {
    Papa.parse(data_url, {
        download: true,
        header: true,
        skipEmptyLines:true,
        complete: (results) => fetchSpreadsheetData(results.data)
    });
};

// transformation données brutes pour être compatibles avec la carte
function fetchSpreadsheetData(res) {
    res.forEach(e => { fs_tab_fetched.push(e)});
    // transformations avant utilisation
    fs_tab_fetched.forEach(e => {
        e.itinerance = e["itinerance"].toLowerCase();
        if(e.id_fs) {
            e.matricule = e.id_fs;
            e.departement = e.insee_dep
            e.commentaire_horaires = e.commentaire
        }
        
        if(e.itinerance == "non" || e.itinerance == "") {
            if(e.format_fs == "Espace labellisé") {
                e.type = "Siège";
            } else if(e.format_fs == "Antenne") {
                e.type = "Antenne";
            }
        } else {
            e.type=  "Bus";
        };
    });
    /* filter on lines with latlng */
    fs_tab_fetched = fs_tab_fetched.filter(e => {
        return e.latitude != 0 & e.latitude != "" & e.longitude != 0 & e.longitude != ""
    });
    // stockage données en local pour ne pas faire appel aux données à chaque rechargement
    sessionStorage.setItem("session_local", JSON.stringify(fs_tab_fetched));
    loading.remove();
    page_status = "loaded";
};


// ****************************************************************************

// Loading screen
const loadingScreen = {
    template:`
        <div>
            <div class="w-100 h-100 d-flex flex-column justify-content-center align-items-center" id = "loading">
                <div class="row">
                    <div class="spinner-border" role="status">
                        <p class="sr-only">Loading...</p>
                    </div>
                </div>
                <div class="row">
                    <p>Chargement des données en cours ...</p>
                </div>
            </div>
        </div>
    `
};


// ****************************************************************************



let searchGroupComponent = {
    template: `
            <div id="search-bar-container">
                <div id = "search-type-group">
                    <span id="search-type-text">Rechercher par :</span>
                    <div class="btn-group btn-group-toggle" id="search-type-radio" data-toggle="buttons">
                        <label class="search-type-btn btn btn-outline-primary active" aria-label="Rechercher une adresse" title="Rechercher une adresse">
                            <input type="radio" name="address" id="adresse-btn" @click="onChange($event)" checked>Adresse
                        </label>
                        <label class="search-type-btn btn btn-outline-primary" aria-label="Rechercher un département" title="Rechercher un département">
                            <input type="radio" name="admin" id="dep-btn" @click="onChange($event)">Département
                        </label>
                    </div>
                </div>
                <div class="input-group">
                        <input ref="input" class="form-control"
                                id="search-field" type="search"
                                :placeholder="placeholderTag" 
                                v-model="inputAdress"
                                @keyup="onKeypress($event)" 
                                @keydown.down="onKeyDown"
                                @keydown.up="onKeyUp"
                                @keyup.enter="onEnter">
                        <button type="button" class="card-btn btn btn-outline-primary" id="btn-reinitialize" data-toggle="tooltip" title="Réinitialiser la recherche" @click="clearSearch">
                            <i class="las la-redo-alt"></i>
                        </button>
                </div>
                <div class="list-group" v-if="isOpen">
                    <div class="list-group-item" v-for="(suggestion, i) in suggestionsList"
                        @click="onClickSuggest(suggestion)"
                        @keydown.esc="isOpen=false"
                        @mouseover="onMouseover(i)"
                        @mouseout="onMouseLeave"
                        :class="{ 'is-active': i === index }">
                        <div v-if="searchType === 'address'">
                            <span class="search-result-label">
                                {{ suggestion.properties.label }}
                            </span><br>
                            <span class="search-result-context">
                                {{ suggestion.properties.context }}
                            </span>
                            <span class="search-result-type">
                                {{ suggestion.properties.type }}
                            </span>
                        </div>
                        <div v-else>
                            <span class="search-result-label">
                                {{ suggestion.nom }}
                            </span>
                            <span class="search-result-type">
                                {{ suggestion.code }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>`,
    data() {
        return {
            searchType:'address',
            inputAdress:'',
            isOpen:false,
            index:0,
            suggestionsList:[],
        }
    },
    computed: {
        placeholderTag() {
            if(this.searchType == "address") {
                return "Saisissez une adresse ..."
            } else {
                return "Saisissez un nom ou code de département ..."
            }
        },
        searchType() {
            if(qtype == 'address' || qtype == 'admin') {
                return qtype
            } else {
                return 'address'
            }
        }
    },
    watch: {
        inputAdress() {
            if(!this.inputAdress) {
                this.isOpen = !this.isOpen;
                this.index = 0;
                this.suggestionsList = [];
            }
        }
    },
    mounted() {
        document.addEventListener("click", this.handleClickOutside);
        document.addEventListener("keyup", (e) => {
            if(e.key === "Escape") {
                this.isOpen = false;
                this.index = -1;

            }
        });
        
    },
    destroyed() {
        document.removeEventListener("click", this.handleClickOutside);
        document.removeEventListener("keyup", (e) => {
            if(e.key === "Escape") {
                this.isOpen = false;
                this.index = -1
                this.handleClickOutside();
            }
        });
    },
    methods: {
        returnType(type) {
            switch (type) {
                case "housenumber":
                    return type = "Numéro";
                case "street":
                    return type = "Rue";
                case "locality":
                    return type = "Lieu-dit";
                case "municipality":
                    return type = "Commune";
            };
        },
        onChange(e) {
            this.searchType = e.target.name;
            this.inputAdress = '';
            this.$emit('searchType', this.searchType)
        },
        onKeypress(e) {
            this.isOpen = true;
            let val = this.inputAdress;
            
            if(val === '') { this.isOpen = false; };
            if (val != undefined && val != '') {
                if(this.searchType == 'address') {
                    fetch(`${api_adresse}${val}&autocomplete=1`)
                        .then(res => res.json())
                        .then(res => {
                            let suggestions = [];
                            if(res && res.features) {
                                let features = res.features;
                                features.forEach(e => {
                                    e.properties.type = this.returnType(e.properties.type)
                                    suggestions.push(e);
                                });
                            };
                            this.suggestionsList = suggestions;
                        }).catch(error => console.error(error));
                } else if(this.searchType == 'admin') {
                    let field;
                    let number = val.match(/\d+/);
                    if(number) {
                        field = "code="
                    } else {
                        field = "nom="
                    };
                    fetch(`${api_admin}${field}${val}&autocomplete=1&limit=5`)
                    .then(res => res.json())
                    .then(res => {
                        let suggestions = [];
                        if(res) {
                            res.forEach(e => {
                                suggestions.push(e);
                            });
                        };
                        this.suggestionsList = suggestions;
                    }).catch(error => console.error(error));
                }
            }
        },
        onKeyUp(e) {
            if (this.index > 0) {
                this.index = this.index - 1;
            }
        },
        onKeyDown(e) {
            if (this.index < this.suggestionsList.length) {
                this.index = this.index + 1;
            }
        },
        onMouseover(e) {
            this.index = e;
        },
        onMouseLeave() {
            this.index = -1;
        },
        onEnter() {
            this.isOpen = !this.isOpen;
            if(this.suggestionsList.length != 0) {
                suggestion = this.suggestionsList[this.index];
                if(this.searchType == "address") {
                    this.inputAdress = suggestion.properties.label;
                    // send data
                    this.$emit("searchResult", {
                        resultType:'address',
                        resultCoords: [suggestion.geometry.coordinates[1],suggestion.geometry.coordinates[0]], 
                        resultLabel: suggestion.properties.label
                    })
                } else {
                    this.inputAdress = suggestion.nom;
                    this.$emit('searchResult', {
                        resultType:'dep',
                        resultCode:suggestion.code
                    });
                }
                this.suggestionsList = [];
                this.index = -1;
            }
        },
        onClickSuggest(suggestion) {            
            if(this.searchType == 'address') {
                // reset search
                this.inputAdress = suggestion.properties.label;
                // get address coordinates to pass to map
                let coordinates = suggestion.geometry.coordinates;
                let latlng_adress = [coordinates[1], coordinates[0]];
    
                // send data
                this.$emit("searchResult", {
                    resultType:'address',
                    resultCoords: latlng_adress, 
                    resultLabel: this.inputAdress
                });
            } else {
                this.inputAdress = suggestion.nom;
                // send data
                this.$emit("searchResult", {
                    resultType:'dep',
                    resultCode:suggestion.code,
                    resultNom:suggestion.nom
                });                
            }
            
            this.suggestionsList = [];
            this.isOpen = !this.isOpen;

        },
        handleClickOutside(evt) {
            if (!this.$el.contains(evt.target)) {
              this.isOpen = false;
              this.index = -1;
            }
        },
        clearSearch() {
            this.inputAdress = '';
            document.getElementById("search-field").value = "";
            this.$emit('clearSearch')
        }
    },
};




// FICHE PDF ****************************************************************************

window.jsPDF = window.jspdf.jsPDF

let pdfComponent = {
    computed: {
        fs() {
            return this.$route.params.fs
        },
        tooltipType() {
            let type = this.fs.type;
            if(type === "Siège") {
                return 'siege'
            } else if(type === "Antenne") {
                return 'antenne'
            } else if(type === "Bus") {
                return 'bus'
            }
        },
        date() {
            let todayDate = new Date(Date.now());
            return todayDate.toLocaleDateString()
        }
    },
    mounted() {
        let fs = this.fs;
        let coords = [fs.latitude,fs.longitude];
        let map = new L.map('map-pdf', {
            center: [params.get("lat") || 46.413220, params.get("lng") || 1.219482],
            zoom:params.get("z") || defaultZoomLevel,
            preferCanvas: true,
            zoomControl:false
        }).setView(coords,16);
        
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
            attribution: '<a href="https://agence-cohesion-territoires.gouv.fr/" target="_blank">ANCT</a> | Fond cartographique &copy;<a href="https://stadiamaps.com/">Stadia Maps</a> &copy;<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy;<a href="http://openstreetmap.org">OpenStreetMap</a>',
        }).addTo(map);

        L.control.scale({ position: 'bottomright', imperial:false }).addTo(map);

        // let tooltipContent = `
        // <span class='leaflet-tooltip-header ${this.tooltipType}'>${fs.lib_fs}</span>
        // <span class='leaflet-tooltip-body'>${fs.code_postal} ${fs.lib_com}</span>`;

        new L.marker(coords, {
            icon: L.icon({
                iconUrl: './img/picto_siege.png',
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            })
        }).addTo(map)

        setTimeout(() => {
            let router = this.$router;

            let pdf = new jsPDF('p','mm',[210,297]);
            pdf.setFont("Marianne-Regular");
            
            let htmlToPrint = this.$el;

            let outputFileName = 'france-services-fiche-' + this.fs.matricule + '.pdf'
            
            pdf.html(htmlToPrint, {
                margin:[5,16,0,16],
                html2canvas: {
                    scale:0.25
                },
                callback:function(pdf) {
                    pdf.save(outputFileName)
                    router.push({path:'/'})
                }
            });
        }, 500);
    },
    template:`
        <div class="container-sm" id="fiche-pdf">
        <div class="row">
                <div class="header-pdf-logos">
                    <img src="img/logo_rf.jpg" class="logo-rf">
                    <img src="img/logo_FranceServices_sans-marianne-01.jpg" class="logo-fs">
                </div>
                <div class="col-11 p-0">
                    <span style="font-size:.8em">Fiche d'information France services - données extraites le {{ date }}</span>
                    <h2 style='font-weight:bolder'><b>{{ fs.lib_fs }}</b></h2><br>
                    <div class = "intro">
                        <p v-if="fs.itinerance=='oui'">
                            <span>Attention : cette France services est en itinérance</span>
                        </p>
                        <p>
                            Immatriculation de véhicules, RSA, impôt, permis de conduire, accès aux services en ligne... Vous avez besoin d’aide pour vos démarches administratives ? Quel que soit l’endroit où vous vivez, en ville ou à la campagne, France services est un guichet unique qui donne accès dans un seul et même lieu aux principaux organismes de services publics : le ministère de l'Intérieur, le ministère de la Justice, les Finances publiques, Pôle emploi, l'Assurance retraite, l'Assurance maladie, la CAF, la MSA et la Poste.</p>
                        <p>
                            Retrouvez la France services la plus proche de chez vous sur <a href="france-services.gouv.fr" target="_blank">france-services.gouv.fr</a> 
                        </p>
                        <div class="row">
                            <div class="col-6">
                                <h5>
                                    <!--<i class = "las la-map-marker"></i>-->
                                    <b>Adresse</b>
                                </h5>
                                <div>
                                    <span>
                                        {{ fs.adresse }} <br>
                                    </span>
                                    <span v-if = "fs.complement_adresse.length">
                                        {{ fs.complement_adresse }}<br>
                                    </span>
                                    <span>
                                        {{ fs.code_postal }} {{ fs.lib_com }}
                                    </span>
                                </div><br>
                                <div>
                                    <p>
                                        <h5>
                                            <!--<i class = "las la-clock"></i>-->
                                            <b>Horaires d'ouverture</b>
                                        </h5>
                                        <ul style="list-style: none;display: inline-block;padding-left: 5px;">
                                            <li>
                                                <b>Lundi : </b>{{ fs.h_lundi }} 
                                            </li>
                                            <li>
                                                <b>Mardi : </b>{{ fs.h_mardi }} 
                                            </li>
                                            <li>
                                                <b>Mercredi : </b>{{ fs.h_mercredi }} 
                                            </li>
                                            <li>
                                                <b>Jeudi : </b>{{ fs.h_jeudi }} 
                                            </li>
                                            <li>
                                                <b>Vendredi : </b>{{ fs.h_vendredi }} 
                                            </li>
                                            <li>
                                                <b>Samedi : </b>{{ fs.h_samedi }} 
                                            </li>
                                        </ul>
                                    </p>
                                    <h5>
                                        <!--<i class = "las la-phone"></i>-->
                                        <b>Contact</b>
                                    </h5>
                                    <span v-if = "fs.telephone"><b>Téléphone : </b>{{ fs.telephone }}</span><br>
                                    <span v-if = "fs.mail"><b>Courriel : </b><a v-bind:href = "'mailto:' + fs.mail" target = "_blank">{{ fs.mail }}</a></span>
                                </div><br>
                            </div>
                            <div class="col-6">
                                <div id="map-pdf"></div>
                            </div>
                        </div>
                    </div><br>
                    <div class="corps">
                        <div v-if="fs.commentaire_horaires">
                            <!--<i class = "las la-info-circle"></i>-->
                            <h5><b>Commentaire(s)</b></h5>
                            <span>{{ fs.commentaire_horaires }}</span>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    `
};


// ****************************************************************************

let cardControlBtn = {
    props:["icon","text"],
    data() {
        return {
            show:false
        }
    },
    template: `
        <button type="button" class="card-action-btn action btn btn-outline-primary btn" 
                @click="event.stopPropagation()" 
                @mouseover="show=true" @mouseleave="show=false"
                aria-label=""
                title="">
            <i :class="'las la-'+icon"></i>
            <span v-if="show" @mouseover="show=true" @mouseout="show=false">{{ text }}</span>
        </button>

    `
};


// ****************************************************************************


let cardTemplate = {
    props: ['fs', 'cardToHover', 'collapse'],
    data () {
      return {
        showInfo:false,
        hoverStyle:'',
        clicked:false,
        showTooltip:false,
      }
    },
    components: {
        'control-btn':cardControlBtn
    },
    mounted() {
        // control collapsing : if only one card is on side panel than collapse = true else false
        if(this.collapse == true || params.get('qtype') == "click") {
            this.showInfo = true
        } else {
            this.showInfo = this.showInfo;
        }
        document.addEventListener("selectionchange",event=>{
            // this.showInfo = false;
            // let selection = document.getSelection ? document.getSelection().toString() :  document.selection.createRange().toString() ;
            // console.log(selection);
        })
    },
    methods: {
        getClass() {
            return {
                'fs-siege': this.fs.type === 'Siège',
                'fs-antenne': this.fs.type === 'Antenne',
                'fs-bus': this.fs.type === 'Bus',
            }
        },
        getFontIcon() {
            return {
                'las la-home': this.fs.itinerance === 'non',
                'las la-shuttle-van': this.fs.itinerance === 'oui',
            }
        },
        getHoveredCard() {
            if(this.cardToHover === this.fs.matricule) {
                return "hovered"
            } else {
                return "card"
            }
        },
        hoverOnMap() {
            this.$emit('hoverOnMap', this.fs.matricule);
        },
        stopHoverMap() {
            this.$emit('hoverOnMap', '');
        },
        zoomOnMap() {
            event.stopPropagation();
            map = this.$parent.map;
            map.flyTo([this.fs.latitude, this.fs.longitude],16, {
                duration:1,
            });
        },
        flyOnMap() {
            event.stopPropagation();
            map = this.$parent.map;
            map.panTo([this.fs.latitude, this.fs.longitude], {
                duration:1,
            });
        },
        print(fs) {
            let id = fs.matricule;
            this.$htmlToPaper(id);
        },
        getPdf() {
            matricule = this.fs.matricule;
            this.$router.push({name: 'fiche', params: { matricule: matricule, fs:this.fs }});
        },
        copyLink() {
            event.stopPropagation()
            let linkToShare = `${url.origin}/france_services/?qtype=click&matricule=${this.fs.matricule}`;
            navigator.clipboard.writeText(linkToShare);
            // let copiedTooltip = document.getElementsByClassName("copied-tooltip")[0];
            this.showTooltip = true;
        },
        tooltipOff() {
            this.showTooltip = false;
        },
    },
    template: `<div class="card result-card"
                    aria-label="Cliquer pour afficher plus d'informations"
                    title="Cliquer pour afficher plus d'informations"
                    :id="fs.matricule"
                    @click="showInfo = !showInfo" 
                    :class="getHoveredCard()" 
                    @mouseover="hoverOnMap"
                    @mouseout="stopHoverMap">
                <div class="card-header" :class="getClass()">
                  <div class="card-text">
                      <i :class="getFontIcon()"></i> 
                      <span class="card-header-left">{{ fs.lib_fs }}</span>
                      <span class="distance" v-if="fs.distance">
                          <i class = "las la-map-marker"></i>
                          {{ fs.distance }} km
                      </span>                      
                  </div>
                </div>
                <div class="card-body"">
                  <div class = "intro">
                    <p v-if="fs.itinerance=='oui'">
                        <i class="las la-exclamation-circle"></i> 
                        <ul>
                            <li>Cette France services est en itinérance</li>
                        </ul>
                    </p>
                    <p>
                        <i class = "las la-map-marker"></i>
                        <ul>
                            <li>
                                {{ fs.adresse }} 
                            </li>
                            <li v-if = "fs.complement_adresse.length">
                                {{ fs.complement_adresse }} 
                            </li>
                            <li>
                                {{ fs.code_postal }} {{ fs.lib_com }}
                            </li>
                        </ul>
                    </p>
                  </div>
                  <div class="corps" v-show="showInfo">
                    <p v-if = "fs.telephone">
                      <i class = "las la-phone"></i>
                      <ul>
                        <li @click="event.stopPropagation()">{{ fs.telephone }}</li>
                      </ul>
                    </p>
                    <p v-if = "fs.mail">
                      <i class = "las la-at card-icon" ></i>
                      <ul>
                          <li><a v-bind:href = "'mailto:' + fs.mail" target = "_blank">{{ fs.mail }}</a></li>
                      </ul>
                    </p>
                    <p>
                        <i class = "las la-clock"></i>
                        <ul>
                            <li>
                                <b>Lundi : </b>{{ fs.h_lundi }} 
                            </li>
                            <li>
                                <b>Mardi : </b>{{ fs.h_mardi }} 
                            </li>
                            <li>
                                <b>Mercredi : </b>{{ fs.h_mercredi }} 
                            </li>
                            <li>
                                <b>Jeudi : </b>{{ fs.h_jeudi }} 
                            </li>
                            <li>
                                <b>Vendredi : </b>{{ fs.h_vendredi }} 
                            </li>
                            <li>
                                <b>Samedi : </b>{{ fs.h_samedi }} 
                            </li>
                        </ul>
                    </p>
                    <p v-if="fs.commentaire_horaires" @click="event.stopPropagation()" class="card-body-commentaire">
                        <i class = "las la-info-circle"></i>                    
                        <ul>
                            <li>{{ fs.commentaire_horaires }}</li>
                        </ul>
                    </p>
                    <p v-if="fs.groupe">
                        <i class="las la-share-alt"></i>
                        Cette structure fait partie du réseau "{{ fs.groupe }}"
                    </p>
                    <div class="card-controls">
                        <control-btn :icon="'search-plus'" :text="'Zoom'" @click.native="zoomOnMap"></control-btn>
                        <control-btn :icon="'arrows-alt'" :text="'Déplacer sur'" @click.native="flyOnMap"></control-btn>
                        <!--<control-btn :icon="'print'" :text="'Imprimer'" @click.native="print(fs)"></control-btn>-->
                        <control-btn :icon="'file-pdf'" :text="'Télécharger'" @click.native="getPdf"></control-btn>
                        <control-btn :icon="'clipboard'" :text="'Partager'" @click.native="copyLink" @mouseout.native="tooltipOff"></control-btn>
                        <span class="copied-tooltip" v-if="showTooltip">Lien copié!</span>
                    </div>
                  </div>
                </div>
              </div>`
  };



// ****************************************************************************


const sliderComponent = {
    data() {
        return {
            radiusVal:'',
            minRadiusVal:0,
            maxRadiusVal:50
        }
    },
    watch: {
        radiusVal() {
            let bubble = this.$refs.bubble;
            const val = this.radiusVal;
            const min = this.minRadiusVal;
            const max = this.maxRadiusVal;
            let pctValue = Number((val-min)*100/(max-min));

            bubble.style.left = `calc(${pctValue}% + (${5 - pctValue * 0.6}px))`;
        }
    },
    mounted() {
        if(params.has("qr")) {
            this.radiusVal = params.get("qr");
        } else {
            this.radiusVal = 10;
        };
        this.emitRadius();
        
    },
    methods: {
        emitRadius() {
                if(params.has("qlatlng")) {
                    params.set("qr",this.radiusVal);
                    window.history.pushState({},'',url);
                };
            this.$emit("radiusVal",this.radiusVal);      
        },
    },
    template:`
        <div id="range-slider-group">
            <span for="customRange1" class="form-label" style="font-size:1.1em;">Rayon de recherche à vol d'oiseau : </span><br>
            <span id="input-thumb" ref="bubble">{{ radiusVal }} km</span>
            <input type="range" class="form-range" 
                   id="distance-slider" 
                   v-model="radiusVal" 
                   @change="emitRadius" 
                   min="minRadiusVal" max="50" step="0.2">
        </div><br>
    `
};


// ****************************************************************************

const resultsCountComponent = {
    props:['nbResults','type'],
    computed: {
        styleSheet() {
            return {
                background:this.color
            }
        },
        color() {
            switch (this.type) {
                case "siege":
                    return "rgb(41,49,115)";
                case "bus":
                    return "#00ac8c";
                case "antenne":
                    return "#5770be";
            }
        },
        text() {
            switch (this.type) {
                case "siege":
                    return 'fixe';
                case "bus":
                    return "itinérante";
                case "antenne":
                    return "antenne";
            }
        }
    },
    template: `
        <span class="nb-result-per-type" :style="styleSheet">
            <b>{{ nbResults }}</b> {{ text }}<span v-if="nbResults>1">s</span>
        </span>
    `
}


// ****************************************************************************

const sidebarComponent = {
    components: {
        'search-group':searchGroupComponent,
        'card':cardTemplate,
        'slider':sliderComponent,
        'result-count':resultsCountComponent,
    },
    props: ['fromParent', 'cardToHover', 'nbFs','searchTypeFromMap'],
    data() {
        return {
            show:false,
            hoveredCard:'',
            searchResult:'',
            searchType:'address',
        }
    },
    computed: {
        map() {
            return this.$parent.map;
        },
        nbResults() {
            return {
                siege:this.countResultByType("Siège"),
                bus:this.countResultByType("Bus"),
                antenne:this.countResultByType("Antenne")
            }
        }
    },
    watch: {
        fromParent() {
            this.show = true;
            this.collapse = false;
        },
        cardToHover(card_id) {
            hoveredCard = card_id;
        },
        searchTypeFromMap(value) {
            this.searchType = value;
        }
    },
    methods: {
        fsCounter(category) {
            final_count = this.nbFs.filter(e => {
                return e.type == category
            }).length;
            return final_count;
        },
        countResultByType(type) {
            let nb = this.fromParent.filter(e => {
                return e.type == type
            }).length;
            return nb
        },
        getHoveredCard(id) {
            if(id) {
                this.$emit('markerToHover', id);
            } else {
                this.$emit('markerToHover', '');
            }
        },
        getSearchResult(result) {
            // emit search result from child to parent (map)
            this.$emit("searchResult",result);
            this.searchResult = result;
            // this.searchType = result.resultType;
        },
        getSearchType(e) {
            this.searchType = e;
        },
        clearSearch() {
            this.$emit('clearMap');
        },
        zoomOnResults() {
            this.$emit('zoomOnResults')
        },
        countNbCategory(number,category) {
            setTimeout(() => {
                final_count = this.data.filter(e => {
                    return e.format_fs == category
                }).length;
                this.interval = setInterval(() => {
                    number++;
                    if(number>=final_count) {
                        clearInterval(this.interval)
                    }
                }, .01)
            }, 500);
        },
        radiusVal(e) {
            this.$emit('bufferRadius',e);
        },
        openSearchPanel() {
            this.$emit("openSearchPanel")
        },
    },
    template: ` 
        <div id="sidebar" class="leaflet-sidebar collapsed">
            <!-- nav tabs -->
            <div class="leaflet-sidebar-tabs">
                <!-- top aligned tabs -->
                <ul role="tablist">
                    <li><a href="#home" role="tab"><i class="las la-home"></i></a></li>
                    <li><a href="#search-tab" role="tab"><i class="las la-search"></i></a></li>
                    <li><a href="#a-propos" role="tab"><i class="la la-question-circle"></i></a></li>
                </ul>
                <!-- bottom aligned tabs -->
                <!--<ul role="tablist">
                    <li><a href="#a-propos" role="tab"><i class="la la-question-circle"></i></a></li>
                    <li><a href="https://github.com/cget-carto/France-services" target="_blank"><i class="la la-github"></i></a></li>
                </ul>-->
            </div>
            <!-- panel content -->
            <div class="leaflet-sidebar-content">
                <div class="leaflet-sidebar-pane" id="home">
                    <div class="leaflet-sidebar-header">
                        <span>Accueil</span>
                        <span class="leaflet-sidebar-close">
                            <i class="las la-step-backward"></i>
                        </span>
                    </div>
                    <div class="panel-content">
                        <div class="header-logo">
                            <img src="img/logo_FranceServices-01.png" id="programme-logo">
                        </div>
                        <!--<div class="row">
                            <card-number :nb="fsCounter('Siège')" :category="'Siège'" text="structures"></card-number>
                            <card-number :nb="fsCounter('Antenne')" :category="'Antenne'" text="antennes"></card-number>
                            <card-number :nb="fsCounter('Bus')" :category="'Bus'" text="bus"></card-number>
                        </div>-->
                        <p>France services est un nouveau modèle d’accès aux services publics pour les Français. L’objectif est de permettre à chaque citoyen d’accéder aux services publics du quotidien dans un lieu unique : réaliser sa demande de carte grise, remplir sa déclaration de revenus pour les impôts sur internet ou encore effectuer sa demande d’APL. Des agents polyvalents et formés sont présents dans la France services la plus proche de chez vous pour vous accompagner dans ces démarches.</p>
                        <p>France services est un programme piloté par le <a href="https://www.cohesion-territoires.gouv.fr/" target="_blank">ministère de la Cohésion des territoires et des Relations avec les collectivités territoriales</a> via l'Agence nationale de la cohésion des territoires (ANCT).</p>
                        <button type="button" class="card-btn btn btn-outline-primary btn-home-tab" @click="openSearchPanel">
                            <i class="las la-search"></i>
                            Trouver une France services
                        </button>
                        <button type="button" class="card-btn btn btn-outline-primary btn-home-tab" @click="window.open('https://agence-cohesion-territoires.gouv.fr/france-services-36')">
                            <i class="las la-question-circle"></i>
                            En savoir plus
                        </button>
                    </div>
                </div>
                <div class="leaflet-sidebar-pane" id="search-tab">
                    <div class="leaflet-sidebar-header">
                        <span>Recherche</span>
                        <span class="leaflet-sidebar-close">
                            <i class="las la-step-backward"></i>
                        </span>
                    </div>
                    <div>
                        <div id="search-inputs">
                            <search-group @searchResult="getSearchResult" @searchType="getSearchType" @clearSearch="clearSearch" ref="searchGroup"></search-group>
                            <hr/>
                            <slider @radiusVal="radiusVal" v-if="params.get('qtype')=='address'"></slider>
                        </div>
                        <div id="search-results-header" v-if="fromParent.length>0">
                            <span id="nb-results" v-if="params.get('qtype')!='click'">
                                <b>{{ fromParent.length }}</b> résultat<span v-if="fromParent.length>1">s</span>
                            </span>
                            <button class="card-btn action btn btn-outline-primary btn"
                                    style='float:right;margin-top:5px'
                                    @click="zoomOnResults"
                                    v-if="params.get('qtype')!='click'">
                                <i class="las la-compress-arrows-alt"></i>
                                Voir les résultats
                            </button>
                        </div>
                        <div id="results" v-if="fromParent.length >0">
                            <div style="margin-bottom:15px" v-if="params.get('qtype')!='click'">
                                <result-count :nbResults="nbResults.siege" 
                                            :type="'siege'" 
                                            v-if="nbResults.siege">
                                </result-count>
                                <result-count :nbResults="nbResults.bus" 
                                            :type="'bus'" 
                                            v-if="nbResults.bus">
                                </result-count>
                                <result-count :nbResults="nbResults.antenne"
                                            :type="'antenne'" 
                                            v-if="nbResults.antenne">
                                </result-count>
                            </div>
                            <card v-if="show"
                                v-for="(fs, index) in fromParent"
                                :collapse="collapse"
                                :fs="fs" :key="index"
                                :cardToHover="cardToHover"
                                @hoverOnMap="getHoveredCard">
                            </card>
                        </div>
                        <p style="text-align:center"v-if="Array.isArray(fromParent) & fromParent.length==0">
                            <br>Aucun résultat ... Veuillez ajuster le rayon de recherche
                        </p>
                    </div>
                </div>
                <div class="leaflet-sidebar-pane" id="a-propos">
                    <h2 class="leaflet-sidebar-header">
                        À propos
                        <span class="leaflet-sidebar-close">
                            <i class="las la-step-backward"></i>
                        </span>
                    </h2>
                    <a href="https://agence-cohesion-territoires.gouv.fr" target="_blank"><img src="img/logo_anct.png" width="100%" style = 'padding-bottom: 5%;'></a>
                    <a href="https://www.banquedesterritoires.fr/" target="_blank"><img src="img/logo_bdt.png" width="100%" style = 'padding-bottom: 5%; '></a>
                    <p>
                        <b>Données :</b>
                        ANCT & Banque des territoires
                    </p>
                    <p>
                        <b>Réalisation :</b>
                        ANCT, Pôle analyse & diagnostics territoriaux - <a href = 'https://cartotheque.anct.gouv.fr/cartes' target="_blank">Service cartographie</a>
                    </p>
                    <p><b>Technologies utilisées :</b> Leaflet, Bootstrap, VueJS, Turf, Étalab - API Geo </p>
                    <p><b>Géocodage : </b>Étalab - Base adresse nationale</p>
                    <p>Les données affichées sur cette carte sont disponibles et téléchargeables sur <a href="https://www.data.gouv.fr/fr/datasets/liste-des-structures-france-services/" target="_blank">data.gouv.fr</a>.</p>
                    <p>Le code source de cet outil est disponible sur <a href="https://github.com/anct-carto/france_services" target="_blank">Github</a>.</p>
                </div>
            </div>
        </div>
    `
};


// ****************************************************************************

// init vue-leaflet

let markerToHover;

const mapComponent = {
    template: `
        <div>
            <sidebar :fromParent="fs_cards" 
                     :cardToHover="hoveredMarker"
                     :nbFs="data"
                     :searchTypeFromMap="searchType"
                     @markerToHover="getMarkertoHover" 
                     @bufferRadius="updateBuffer" 
                     @searchResult="getSearchResult"
                     @openSearchPanel="openSearchPanel"
                     @zoomOnResults="zoomOnResults"
                     @clearMap="clearMap"
                     ref="sidebar">
            </sidebar>
            <div id="mapid" ref="map"></div>
        </div>
    `,
    components: {
        'sidebar': sidebarComponent,
    },
    data() {
        return {
            mapOptions: {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                attribution: '<a href="https://cartotheque.anct.gouv.fr/cartes" target="_blank">ANCT</a> | Fond cartographique &copy;<a href="https://stadiamaps.com/">Stadia Maps</a> &copy;<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy;<a href="http://openstreetmap.org">OpenStreetMap</a>',
                zoom: 6,
                center: [46.413220, 1.219482],
                zoomSnap: 0.25,
                zoomControl: false,
            },
            data: fs_tab_fetched,
            circlesStyle: {
                radius:5.5,
                color:'white',
                weight:1.2,
                fillOpacity:1,
                className:'fs-marker',
            },
            tooltipOptions: {
                direction:'top',
                className:'leaflet-tooltip-hovered',
            },
            hoveredMarker:'',
            marker: null,
            marker_tooltip: null,
            depFilter:null,
            fs_cards:'',
            sidebar:null,
            map:null,
            markerToHover:{
                coords:'',
            },
            searchRadius:10,
            searchType:'',
        }
    },
    computed: {
        adressLayer() {
            return L.layerGroup({className:'address-marker-layer'}).addTo(this.map)
        },
        buffer() {
            if(this.marker) {
                return L.circle(this.marker, {
                    color:'red',
                    fillColor:'rgba(0,0,0,1)',
                    interactive:false
                })
            }
        },
        clickedMarkerLayer() {
            return L.layerGroup({className:'clicked-marker-layer'}).addTo(this.map);
        },
        maskLayer() {
            return L.layerGroup({className:'buffer-layer'}).addTo(this.map)
        },
        iframe() {
            if ( window.location === window.parent.location ) {	  
                return true;
            } else {	  
                // console.log("iframe : false")
                return false;
            };
        },
    },
    watch: {
        marker() {
            let list_points = [];
            // reset everything : clear layers, previous clicked markers
            this.clearMap();
            
            // drop marker of searched address on map
            if(this.marker) {
                let address_marker = L.marker(this.marker)
                                .bindTooltip(this.marker_tooltip, {
                                    permanent:true, 
                                    direction:"top", 
                                    className:'leaflet-tooltip-result'
                                }).openTooltip();
                this.adressLayer.addLayer(address_marker);
            };

            // convert data lat lng to featureCollection
            this.data.forEach(feature => {
                list_points.push(turf.point([feature.latitude, feature.longitude], { id: feature.matricule }))
            });
            list_points = turf.featureCollection(list_points);

            // compute distance for each point
            list_points.features.forEach(feature => {
                // !!!!! REVERSE [lat,lon] TO [lon,lat] FORMAT to compute correct distance !!!!!!!!!!!!
                lon_dest = feature.geometry.coordinates[1];
                lat_dest = feature.geometry.coordinates[0];

                Object.defineProperty(feature.properties, 'distance', {
                    value: turf.distance([this.marker[1],this.marker[0]], [lon_dest, lat_dest], { 
                        units: 'kilometers' 
                    }),
                    writable: true,
                    enumerable: true,
                    configurable: true
                })
            });

            // sort by distance
            list_points.features.sort((a,b) => {
                if(a.properties.distance > b.properties.distance) {
                    return 1;
                } else if (a.properties.distance < b.properties.distance) {
                    return -1
                } else if(a.properties.distance === b.properties.distance) {
                    return 0
                }
            });

            let closest_points = list_points.features;

            // send ids of found fs to data prop
            let closest_fs = [];
            closest_points_id = closest_points.map(e => { return e.properties.id })

            closest_fs = this.data.filter(e => {
                return closest_points_id.includes(e.matricule)
            });

            closest_fs.forEach(e => {
                closest_points.forEach(d => {
                    if(d.properties.id === e.matricule) {
                        e.distance = Math.round(d.properties.distance*10)/10
                    }
                })
            });

            // if radius in url then take url radius
            if(this.params.has('radius')) {
                searchRadius = this.params.get('radius')
            } else {
                searchRadius = this.searchRadius
            }

            this.fs_cards = closest_fs.filter(e => {
                return e.distance <= searchRadius
            }).sort((a,b) => {
                if(a.distance > b.distance) {
                    return 1;
                } else if (a.distance < b.distance) {
                    return -1
                } else if (a.distance === b.distance) {
                    return 0
                }
            });

            // create buffer 
            radius = this.searchRadius*1000;
            perimetre_recherche = this.buffer.setRadius(radius);
            this.maskLayer.addLayer(perimetre_recherche);
            // pan map view to circle with offset from sidebar
            this.flyToBoundsWithOffset(perimetre_recherche);

            this.searchType = "address"
            // setup url params
            this.params.set('qtype','address');
            this.params.set('qlatlng',this.marker);
            this.params.set('qlabel',this.marker_tooltip);
            this.params.set('qr',this.searchRadius);
            window.history.pushState({},'',this.url);
        },
        depFilter() {
            // clear address layers (buffer + pin address)
            this.clearMap();
            this.searchType = "dep";

            // filter data with matching departement code and send it to cards
            this.fs_cards = this.data.filter(e => {
                return e.departement == this.depFilter
            }).sort((a,b) => {
                let compare = 0;
                a.lib_fs > b.lib_fs ? compare = 1 : compare = 0;
                return compare 
            });
            // purge object from distance property (computed in 'address' search)
            this.fs_cards.forEach(e => delete e.distance);

            let filteredFeature = this.geom_dep.features.filter(e => {
                return e.properties.insee_dep === this.depFilter;
            });
            let depMask = L.mask(filteredFeature, {
                fillColor:'rgba(0,0,0,.25)',
                color:'red'
            });
            this.maskLayer.addLayer(depMask);

            // pan to dep borders
            this.flyToBoundsWithOffset(new L.GeoJSON(filteredFeature));
            // setup url params
            this.clearURLParams();
            this.params.set('qtype','admin');
            this.params.set('qcode',this.depFilter);
            let qlabel = filteredFeature[0].properties.lib_dep;
            this.params.set('qlabel',qlabel);
            // window.history.pushState({},'',this.url);            
        },
    },
    mounted() {
        session_data = JSON.parse(sessionStorage.getItem("session_local"));

        if(!session_data) {
            init();
            this.loadDep();
        } else {
            this.geom_dep = JSON.parse(sessionStorage.getItem("LocalGeomDep"));
            page_status = "loaded";
            loading.remove();
            this.data = session_data;
            fs_tab_fetched = session_data;
        };

        this.initMap();
        this.checkPageStatus();

        // this.map.on("click", (e) => {
        //     console.log(e);
        //     fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${e.latlng.lng}&lat=${e.latlng.lat}`)
        //     .then(res => res.json())
        //     .then(res => {
        //         e = {
        //             resultType:'address',
        //             resultCoords:[e.latlng.lat, e.latlng.lng],
        //             resultLabel:res.features[0].properties.label
        //         };
        //         this.getSearchResult(e)
        //     })
        // });

    },
    methods: {
        initMap() {
            this.params = params;
            this.url = url;

            searchQuery = document.getElementById('search-field');
            searchQuery.value = params.get("qlabel") || "";

            let defaultZoomLevel = this.iframe ? 6 : 5.55;

            // const map = L.map('mapid', this.mapOptions);
            const map = new L.map('mapid', {
                center: [params.get("lat") || 46.413220, params.get("lng") || 1.219482],
                zoom:params.get("z") || defaultZoomLevel,
                preferCanvas: true,
                zoomControl:false
            });

            // Get url parameters
            map.on("moveend", () => {
                // get map params
                lat = map.getCenter().lat.toFixed(6);
                lng = map.getCenter().lng.toFixed(6);
                zoom = map.getZoom();

                params.set("lat",lat);
                params.set("lng",lng);
                params.set("z",zoom);
             
                window.history.pushState({},'',url)
            });
            
            // this.iframe ? map.setZoom(6) : map.setZoom(5.55);
            L.tileLayer(this.mapOptions.url,{ attribution:this.mapOptions.attribution }).addTo(map);
            this.map = map;
            // zoom control, fullscreen & scale bar
            L.control.zoom({position: 'topright'}).addTo(map);
            L.control.fullscreen({
                position:'topright',
                forcePseudoFullScreen:true,
            }).addTo(this.map);
            L.control.scale({ position: 'bottomright', imperial:false }).addTo(map);

            // sidebar
            const sidebar = window.L.control.sidebar({
                autopan: true, 
                closeButton: true, 
                container: "sidebar", 
                position: "left"
            }).addTo(map);
            this.sidebar = sidebar;
            
            // legend
            const legend = L.control({position: 'topright'});

            legend.onAdd = function (map) {
                let expand = false;
                var div = L.DomUtil.create('div', 'leaflet-legend');
                div.title = "Légende";
                div.ariaLabel = "Légende";

                let content_default = "<i class='la la-list' aria-label='Légende'></i>";
                div.innerHTML += content_default;
                
                div.addEventListener("click", () => {
                    event.stopPropagation()
                    if(expand === false) {
                        expand = true;
                        // here we can fill the legend with colors, strings and whatever
                        div.innerHTML = `<span style="font-family:'Marianne-Bold'">Type de structure</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-marker-siege"></span><span> Site principal</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-marker-bus"></span><span> Bus itinérant</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-marker-antenne"></span><span> Antenne</span><br>`;
                    } else if (expand == true) {
                        expand = false;
                        div.innerHTML = content_default;
                    };
                    map.on("click", ()=>{
                        if(expand === true) {
                            expand = false
                            div.innerHTML = content_default;
                        };
                    });
                });
                return div;
            };
            legend.addTo(map);

            // texte en cours de développement
            // const enDeveloppement = L.control({position: 'topleft'});
            // enDeveloppement.onAdd = function() {
            //     let div = L.DomUtil.create('div','en-developpement');
            //     div.innerHTML += `<h5 style="font-family:'Marianne-Bold';color:red;background-color:white; padding:5px; border: solid 1px red">/!\\ DEVELOPPEMENT EN COURS /!\\</h5>`;
            //     return div;
            // };
            // enDeveloppement.addTo(map);

            // on click remove previous clicked marker
            map.on("click",(e) => {
                event.stopPropagation();
                // this.clickedMarkerLayer.clearLayers();
                this.clearURLParams();
                this.clearMap()

            })
        },
        loadDep() {
            fetch("data/geom_dep.geojson")
            .then(res => res.json())
            .then(res => {
                this.geom_dep = res;
                sessionStorage.setItem("LocalGeomDep",JSON.stringify(res))
            });
        },
        flyToBoundsWithOffset(layer) {
            let offset = document.querySelector('.leaflet-sidebar-content').getBoundingClientRect().width;
            this.map.flyToBounds(layer, {paddingTopLeft: [offset, 0], duration:0.75})
        },
        onMouseover(fs) {
            this.markerToHover.coords = [fs.latitude, fs.longitude];
            this.markerToHover.lib = fs.lib_fs;
            
            id = fs.matricule;
            if(this.fs_cards) {
                this.hoveredMarker = id; // send hovered marker's ID to children cards 
            };
        },
        onMouseOut() {
            this.hoveredMarker = '';
            this.markerToHover.coords = '';
            // this.markerToHover.lib = '';
            this.getMarkertoHover('');  
        },
        displayInfo(fs) {
            // empêcher le déclenchement de la réinitialisation si cliqué

            this.sidebar.open('search-tab');          
            // send info of the one clicked point to children (cards)
            if(fs.distance) {
                delete fs.distance;
            };
            this.fs_cards = [fs];
            
            // add white stroke to clicked
            this.clickedMarkerLayer.clearLayers();
            let glowStyle = {
                radius:10,
                weight:10,
                color:'rgba(245,245,245,.75)',
                fillColor:this.getMarkerColor(fs.type),
                fillOpacity:1,
                interactive:false
            };
            let glow10 = new L.circleMarker([fs.latitude, fs.longitude], glowStyle, { weight:10 });
            let glow15 = new L.circleMarker([fs.latitude, fs.longitude], glowStyle, { weight:15 });

            let tooltipContent = `
                    <span class='leaflet-tooltip-header ${this.getTooltipCategory(fs.type)}'>
                        ${fs.lib_fs}
                    </span>
                    <span class='leaflet-tooltip-body'>
                        ${fs.code_postal} ${fs.lib_com}
                    </span>`

            // add marker icon
            let marker = new L.marker([fs.latitude, fs.longitude], {
                icon:L.icon({
                    iconUrl:this.getIconCategory(fs.type),  
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                })
            }).addTo(this.map);

            marker.bindTooltip(tooltipContent, {
                direction:'top',
                opacity:1,
                permanent:true, 
            });

            [glow15,glow10,marker].forEach(el => this.clickedMarkerLayer.addLayer(el))

            // remove buffer and address marker
            this.maskLayer.clearLayers();
            this.adressLayer.clearLayers();

            // setup url params
            this.clearURLParams();
            this.params.set("lat", this.map.getCenter().lat.toFixed(6))
            this.params.set("lng", this.map.getCenter().lng.toFixed(6))
            this.params.set("z", this.map.getZoom())
            this.params.set("qtype","click");
            this.params.set("matricule",fs.matricule);
            window.history.pushState({},'',this.url);
        },
        // styles
        getMarkerColor(type) {
            switch (type) {
                case "Siège":
                    return "rgb(41,49,115)";
                case "Antenne":
                    return "#5770be";
                case "Bus":
                    return "#00ac8c";
            };
        },
        getIconCategory(type) {
            if(type === "Siège") {
                return './img/picto_siege.png'
            } else if(type === "Antenne"){
                return './img/picto_antenne.png'
            } 
            else if(type === "Bus"){
                return './img/picto_itinerante.png'
            }
        },
        getTooltipCategory(type) {
            if(type === "Siège") {
                return 'siege'
            } else if(type === "Antenne") {
                return 'antenne'
            } else if(type === "Bus") {
                return 'bus'
            }
        },
        getMarkertoHover(id) {
            if (id) {
                let fs = this.data.filter(e => {
                    return e.matricule == id;
                })[0];

                this.markerToHover.coords =  [fs.latitude, fs.longitude];
                let type = fs.type;

                markerToHover = L.marker(this.markerToHover.coords, {
                    className:'fs-marker',
                    icon:L.icon({
                        iconUrl:this.getIconCategory(type),  
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    })
                }).addTo(this.map);
                
                let tooltipContent = `
                                <span class='leaflet-tooltip-header ${this.getTooltipCategory(type)}'>${fs.lib_fs}</span>
                                <span class='leaflet-tooltip-body'>${fs.code_postal} ${fs.lib_com}</span>`

                markerToHover.bindTooltip(tooltipContent, {
                    direction:'top',
                    opacity:1,
                    permanent:true, 
                });

            } else {
                markerToHover.removeFrom(this.map);
                this.markerToHover.coords = '';
                this.markerToHover.lib = '';
            }
        },
        getSearchResult(e) {
            // get result infos emitted from search group
            if(e.resultType == "address") {
                this.marker = e.resultCoords;
                this.marker_tooltip = e.resultLabel;
            } else {
                if(this.geom_dep) {
                    this.depFilter = e.resultCode;
                }
            }
        },
        updateBuffer(new_radius) {
            this.searchRadius = new_radius;
            if(this.buffer) {
                this.buffer.setRadius(new_radius*1000);
                this.fs_cards = this.data.filter(e => {
                    return e.distance <= new_radius
                }).sort((a,b) => {
                    if(a.distance > b.distance) {
                        return 1;
                    } else if (a.distance < b.distance) {
                        return -1
                    } else if (a.distance === b.distance) {
                        return 0
                    }
                });
                this.flyToBoundsWithOffset(this.buffer);
            };
        },
        zoomOnResults() {
            let bounds = this.fs_cards.map(e => {
                return [e.latitude,e.longitude]
            });
            this.flyToBoundsWithOffset(bounds);
        },
        clearMap() {
            this.fs_cards = '';
            this.markerToHover.coordinates = '';
            this.clickedMarkerLayer.clearLayers();
            this.maskLayer.clearLayers();
            this.adressLayer.clearLayers();
            // this.map.flyTo(this.mapOptions.center, this.mapOptions.zoom, {duration:0.5});

            // purge url params
            this.clearURLParams();
        },
        clearURLParams() {
           this.url.search = '';
        },
        openSearchPanel() {
            this.sidebar.open('search-tab')
        },
        checkURLParams() {
            let params = this.params;
            queryType = params.get("qtype");

            if(queryType) {
                this.sidebar.open("search-tab");
            }
            switch (queryType) {
                case "address":
                    let resultMarker = params.get("qlatlng").split(",");
                    let resultLabel = params.get("qlabel");    
                    this.marker = resultMarker;
                    this.marker_tooltip = resultLabel;                    
                    this.sidebar.open("search-tab");
                    break;
                case "admin":
                    let resultCodeDep = params.get("qcode");
                    console.log(resultCodeDep);
                    this.depFilter = resultCodeDep;
                    this.sidebar.open("search-tab");
                break;
                case "click":
                    let id = params.get("matricule");
                    let fs = fs_tab_fetched.filter(e => e.matricule == id)[0];
                    this.displayInfo(fs);                    
                    center = this.map.getCenter();
                    this.map.setView([center.lat, fs.longitude]);
                    break;
            };
        },
        // check if app is loaded in an iframe
        checkWindowLocation(ifTrue, ifFalse) {
            if ( window.location === window.parent.location ) {	  
                return ifTrue;
            } else {	  
                return ifFalse;
            };
        },
        // check if data from drive has been loaded 
        checkPageStatus() {
            if(page_status == undefined) {
                window.setTimeout(this.checkPageStatus,10);
            } else {
                // check if app loaded in an iframe
                this.iframe ? this.sidebar.open("home") : this.sidebar.open("search-tab"); 
                // focus on search bar
                // document.getElementById("search-field").focus();

                let circleMarkersLayer = L.layerGroup({});

                for(let i=0; i<fs_tab_fetched.length; i++) {
                    e = fs_tab_fetched[i];

                    let circle = L.circleMarker([e.latitude, e.longitude], this.circlesStyle);
                    circle.setStyle({fillColor:this.getMarkerColor(e.type)})
                    circle.content = e;

                    let circleAnchor = L.circleMarker([e.latitude, e.longitude], {
                        radius:20,
                        fillOpacity:0,
                        opacity:0
                    }).on("mouseover", (e) => { 
                        this.onMouseover(e.sourceTarget.content);
                        this.getMarkertoHover(e.sourceTarget.content.matricule)
                    }).on("mouseout", () => { 
                        this.onMouseOut();
                    }).on("click", (e) => { 
                        L.DomEvent.stopPropagation(e);
                        this.displayInfo(e.sourceTarget.content);
                    });
                    circleAnchor.content = e;
                    circleMarkersLayer.addLayer(circle);
                    circleMarkersLayer.addLayer(circleAnchor);
                }

                this.map.addLayer(circleMarkersLayer);

                this.checkURLParams();
            }
        },
    }
};

const routes = [
    {
        name:'carte',
        path:'/',
        component: mapComponent
    },
    {
        name: 'fiche',
        path: '/fiche:matricule', 
        component: pdfComponent, 
        props:true,
    },
];

const router = new VueRouter({
    // mode:'history',
    routes // raccourci pour `routes: routes`
})

// finale instance vue
const vm = new Vue({
    router,
    el: '#app',
});