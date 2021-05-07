

// geocode
const api_adresse = "https://api-adresse.data.gouv.fr/search/?q=";
const api_admin = "https://geo.api.gouv.fr/departements?nom=";

const loading = document.getElementById("loading");

let data_url = "https://docs.google.com/spreadsheets/d/1_i0-v9EOrFhEiHQSk6wdBFpsfaAU0oxjm-pEhviJdxM/edit?usp=sharing"
let fs_tab_fetched = [];
let page_status;


function init() {
    Tabletop.init({
      key: data_url,
      callback: fetchSpreadsheetData,
      simpleSheet: true,
    })
};

function fetchSpreadsheetData(res) {
    res.forEach(e => { fs_tab_fetched.push(e)});
    fs_tab_fetched.forEach(e => {
        if(e.itinerance == "Non") {
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
        return e.latitude != "" & e.longitude != ""
    });
    sessionStorage.setItem("session_local", JSON.stringify(fs_tab_fetched))
    loading.remove();
    page_status = "loaded";
};

// print function
const print_options = {
    name: '_blank',
    specs: [
      'fullscreen=yes',
      'titlebar=yes',
      'scrollbars=yes'
    ],
    styles: [
        "lib/line-awesome-1.3.0/css/line-awesome.min.css",
        "https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css",
        "css/style.css",
        "css/font.css"  
    ]
  };

Vue.use(VueHtmlToPaper, print_options);



// ****************************************************************************



let search_group_template = {
    template: `
            <div id="search-bar-container">
                <div id = "search-type-group">
                    <span id="search-type-text">Rechercher par :</span>
                    <div class="btn-group btn-group-toggle" id="search-type-radio" data-toggle="buttons">
                        <label class="search-type-btn btn btn-outline-primary active">
                            <input type="radio" name="address" id="adresse-btn" @click="onChange($event)" checked>Adresse
                        </label>
                        <label class="search-type-btn btn btn-outline-primary">
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
                return "Saisissez un nom de département ..."
            }
        }
    },
    watch: {
        inputAdress() {
            if(!this.inputAdress) {
                this.isOpen = !this.isOpen;
                this.index = 0;
                this.suggestionsList = [];
                // this.$emit('searchResult',' ') // reinitialize map
            }
        }
    },
    methods: {
        onChange(e) {
            this.searchType = e.target.name;
            //this.isOpen = !this.isOpen;
            this.inputAdress = '';
        },
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
                    break;
            };
        },
        onKeypress(e) {
            this.isOpen = true;
            let val = this.inputAdress;
            
            if(val === '') {
                this.isOpen = false;                
            };

            if (val != undefined && val != '') {
                if(this.searchType == 'address') {
                    fetch(api_adresse.concat(val, "&autocomplete=1"))
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
                        }).catch(error => console.throw(error));
                } else if(this.searchType == 'admin') {
                    fetch(api_admin.concat(val,"&limit=5"))
                    .then(res => res.json())
                    .then(res => {
                        let suggestions = [];
                        if(res) {
                            res.forEach(e => {
                                suggestions.push(e);
                            });
                        };
                        this.suggestionsList = suggestions;
                    }).catch(error => console.throw(error));
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
                    resultCode:suggestion.code
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
            this.$emit('clearSearch')
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
    }

};

// ****************************************************************************


let card_template = {
    props: ['fs', 'cardToHover', 'collapse'],
    data () {
      return {
        showInfo:false,
        hoverStyle:''
      }
    },
    mounted() {
        // control collapsing : if only one card on side panel than collapse = true else false
        if(this.collapse == true) {
            this.showInfo = true
        } else {
            this.showInfo = this.showInfo;
        }
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
                'las la-home': this.fs.itinerance === 'Non',
                'las la-shuttle-van': this.fs.itinerance === 'Oui',
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
            this.showInfo = false;
            map = this.$parent.map;
            map.flyTo([this.fs.latitude, this.fs.longitude],16, {
                duration:3,
            });
        },
        print(fs) {
            id = fs.matricule;
            this.$htmlToPaper(id);
        }
    },
    template: `<div class="card result-card"
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
                    <p v-if="fs.itinerance=='Oui'">
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
                  <!--<span v-if="showInfo==false" class="collapse-text">
                    <i class = "las la-arrow-down" v-if = "fs.telephone.length"></i>
                    Cliquer pour afficher plus d'informations
                  </span>-->
                  <div class="corps" v-show="showInfo">
                    <p v-if = "fs.telephone">
                      <i class = "las la-phone"></i>
                      <ul>
                        <li>{{ fs.telephone }}</li>
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
                        <ul><b>Horaires d'ouverture</b>
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
                    <p v-if="fs.commentaire_horaires">
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
                        <button type="button" class="card-btn btn btn-outline-primary btn-block" @click="zoomOnMap">
                            <i class="las la-search-plus"></i>
                            Zoom sur la carte
                        </button>
                        <button type="button" class="card-btn btn btn-outline-primary btn-block" @click="print(fs)">
                            <i class="las la-print"></i>
                            Imprimer la fiche
                        </button>
                    </div>
                  </div>
                </div>
              </div>`
  };

// ****************************************************************************

let cardNumber = {
    props:['nb', 'category', 'text'],
    data() {
        return {
            number:0,
            interval:0
        }
    },
    mounted() {
        setTimeout(() => {
            this.interval = setInterval(() => {
                this.number++;
                if(this.number>=this.nb) {
                    clearInterval(this.interval)
                }
            }, 1)
        }, 1);
    },
    template: `<div class="card counters col-sm-3.5">
                    <div class="card-body">
                        <h3 :class="'counter '+category">{{ number }}</h3>
                        <span>{{ text }}</span>
                    </div>
                </div>`
}

// ****************************************************************************

let sidebar_template = {
    components: {
        'search-group':search_group_template,
        'card':card_template,
        'card-number':cardNumber,
    },
    props: ['fromParent', 'cardToHover', 'nbFs'],
    data() {
        return {
            show:false,
            nbResults: '',
            hoveredCard:'',
            searchResult:'',
            searchType:'address',
        }
    },
    computed: {
        map() {
            return this.$parent.map;
        },
        filteredList() {
            return this.fromParent.slice(0, this.nbResults)
        },
        collapse() {
            if(this.fromParent.length>1) {
                return false
            } else {
                return true
            };
        }
    },
    watch: {
        fromParent() {
            this.show = true;
            // switch between searchType (adresse ou departement) to display all results or not
            if(this.searchType == 'address') {
                this.nbResults = 5;
            } else if (this.searchType == 'dep') {
                this.nbResults = this.fromParent.length;
            };
        },
        cardToHover(card_id) {
            hoveredCard = card_id;
        }
    },
    methods: {
        fsCounter(category) {
            final_count = this.nbFs.filter(e => {
                return e.type == category
            }).length;
            return final_count
        },
        showMore() {
            if(this.nbResults <20) {
                this.nbResults += 5;
                // get farest point distance ...
                let index = this.nbResults -1;
                // ... to extand buffer on map
                buffer_radius = this.filteredList[index].distance*1000;
                this.$emit('bufferRadius', buffer_radius);
            }
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
            this.searchType = result.resultType;
        },
        clearSearch() {
            this.$emit('clearMap');
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
        }
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
                        <!--
                        <div class="row">
                            <card-number :nb="fsCounter('Siège')" :category="'Siège'" text="structures"></card-number>
                            <card-number :nb="fsCounter('Antenne')" :category="'Antenne'" text="antennes"></card-number>
                            <card-number :nb="fsCounter('Bus')" :category="'Bus'" text="bus"></card-number>
                        </div>-->
                        <h6>Qu'est ce que France services ?</h6>
                        <p>France services est un nouveau modèle de d’accès aux services publics pour les Français. L’objectif est de permettre à chaque citoyen d’accéder aux services publics du quotidien dans un lieu unique : réaliser sa demande de carte grise, remplir sa déclaration de revenus pour les impôts sur internet ou encore effectuer sa demande d’APL. Des agents polyvalents et formés sont présents dans la France services la plus proche de chez vous pour vous accompagner dans ces démarches.</p>
                        <p>France services est un programme piloté par le <a href="https://www.cohesion-territoires.gouv.fr/" target="_blank">ministère de la Cohésion des territoires et des Relations avec les collectivités territoriales</a> via l'Agence nationale de la cohésion des territoires (ANCT).</p>
                        <h6><a href="https://agence-cohesion-territoires.gouv.fr/france-services-36" target="_blank">En savoir plus sur France services</a></h6>
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
                        <search-group @searchResult="getSearchResult" @clearSearch="clearSearch"></search-group>
                        <div id="search-results-header">
                            <span id="nb-results" v-if="filteredList.length>1">
                                <b>{{ filteredList.length }}</b> résultats
                            </span>
                            <span id="text-distance" v-if="filteredList.length>1 && searchType=='address'">
                                Les distances sont calculées à vol d'oiseau
                            </span>
                        </div>
                        <div id="results">
                            <card v-if="show"
                                v-for="(fs, index) in filteredList"
                                :collapse="collapse"
                                :fs="fs" :key="index"
                                :cardToHover="cardToHover"
                                @hoverOnMap="getHoveredCard">
                            </card>
                        </div>
                        <div class="show-more-btn">
                            <button type="button" class="btn btn-link show-more-btn" 
                            v-if="filteredList.length>1 && filteredList.length<20 && searchType=='address'"
                            v-on:click="showMore">
                                    Afficher plus de résultats
                            </button>
                        </div>
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
                    <p>Le code source de cet outil est disponible sur <a href="https://github.com/anct-carto/france_services" target="_blank">Github</a>.</p>
                </div>
            </div>
        </div>
    `
};


// init vue-leaflet

let markerToHover;

let map_template = {
    template: `
        <div>
            <sidebar :fromParent="fs_cards" 
                     :cardToHover="hoveredMarker"
                     :nbFs="data"
                     @clearMap="clearMap"
                     @markerToHover="getMarkertoHover" 
                     @bufferRadius="updateBuffer" 
                     @searchResult="getSearchResult">
            </sidebar>
            <div id="mapid" ref="map"></div>
        </div>
    `,
    data() {
        return {
            mapOptions: {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                zoom: 6,
                attribution: '<a href="https://agence-cohesion-territoires.gouv.fr/" target="_blank">ANCT</a> | Fond cartographique &copy;<a href="https://stadiamaps.com/">Stadia Maps</a> &copy;<a href="https://openmaptiles.org/">OpenMapTiles</a> &copy;<a href="http://openstreetmap.org">OpenStreetMap</a>',
                center: [46.413220, 1.219482],
                zoomSnap: 0.5,
                zoomControl: false,
                preferCanvas: true
            },
            data: fs_tab_fetched,
            circles: {
                radius:5,
                color:'white',
                weight:1,
                fillOpacity:1,
                className:'fs-marker',
            },
            tooltipOptions: {
                direction:'top',
                sticky:true,
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
                icon: L.icon({
                    iconUrl: function(type) {
                        if(type == "Siège") {
                            return './img/picto_siege.png'
                        } else if(type == "Antenne") { 
                            return './img/picto_antenne.png'
                        } else if(type == "Bus") {
                            return './img/picto_itinerante.png'
                        }
                    },
                    iconSize: [32, 32],
                    iconAnchor: [16, 37]
                })
            },
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
                    fillColor:'white',
                    fillOpacity:0,
                    interactive:false
                })
            }
        },
        clickedMarkerLayer() {
            return L.layerGroup({className:'clicked-marker-layer'}).addTo(this.map);
        },
        bufferLayer() {
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
    components: {
        'sidebar': sidebar_template,
    },
    methods: {
        initMap() {
            const map = L.map('mapid', this.mapOptions);
            this.iframe ? map.setZoom(6) : map.setZoom(5.55);
            L.tileLayer(this.mapOptions.url,
                {attribution:this.mapOptions.attribution}).addTo(map);
            this.map = map;
            // zoom control, fullscreen & scale bar
            L.control.zoom({position: 'topright'}).addTo(map);
            L.control.fullscreen({
                position:'topright',
                forcePseudoFullScreen:true,
                title:'Afficher la carte en plein écran'
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
                
                content_default = "<i class='la la-align-justify'></i>";
                div.innerHTML += content_default;

                
                div.addEventListener("click", () => {
                    if(expand === false) {
                        expand = true;
                        // here we can fill the legend with colors, strings and whatever
                        div.innerHTML = `<span class="leaflet-legend-marker-siege"></span><span> Structure siège</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-marker-antenne"></span><span> Antenne</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-marker-bus"></span><span> Bus</span><br>`;
                        div.innerHTML += `<span class="leaflet-legend-perimeter"></span><span> Périmètre de recherche</span>`;
                    } else if (expand == true) {
                        expand = false;
                        div.innerHTML = content_default;
                    }
                })
    
                return div;
            };
            legend.addTo(map);
        },
        loadDep() {
            fetch("data/geom_dep.geojson")
            .then(res => res.json())
            .then(res => {
                this.geom_dep = res
            });
        },
        flyToBoundsWithOffset(layer) {
            offset = document.querySelector('.leaflet-sidebar-content').getBoundingClientRect().width;
            this.map.flyToBounds(layer, {paddingTopLeft: [offset, 0]})
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
            this.markerToHover.lib = '';
            this.getMarkertoHover('');  
        },
        displayInfo(fs) {
            this.sidebar.open('search-tab')
            
            // send info of the one clicked point to children (cards)
            list_fs_cards = [fs];
            this.fs_cards = list_fs_cards
            
            // add white stroke to clicked
            this.clickedMarkerLayer.clearLayers();
            let glow = new L.circleMarker([fs.latitude, fs.longitude], {
                radius:10,
                color:'rgba(255,255,255,.75',
                weight:10,
                fillColor:this.getMarkerColor(fs),
                fillOpacity:1,
            })
            
            this.clickedMarkerLayer.addLayer(glow);

            // remove buffer and address marker
            this.bufferLayer.clearLayers()
            this.adressLayer.clearLayers()
        },
        getMarkerColor(fs) {
            if(fs.type === "Siège") {
                return "rgb(41,49,115)"
            } else if(fs.type == "Antenne") {
                return "#5770be"
            } else if(fs.type == "Bus") {
                return "#00ac8c"
            }
        },
        getIconCategory(type) {
            if(type === "Siège") {
                return './img/picto_siege.png'
            // } else {
            } else if(type === "Antenne"){
                return './img/picto_antenne.png'
            } 
            else if(type === "Bus"){
                return './img/picto_itinerante.png'
            }
        },
        getTooltipCategory(type) {
            if(type === "Siège") {
                return 'leaflet-tooltip-siege'
            } else if(type === "Antenne") {
                return 'leaflet-tooltip-antenne'
            } else if(type === "Bus") {
                return 'leaflet-tooltip-bus'
            }
        },
        getMarkertoHover(id) {
            if (id) {
                fs = this.data.filter(e => {
                    return e.matricule == id;
                })[0];

                this.markerToHover.coords =  [fs.latitude, fs.longitude];
                type = fs.type;

                markerToHover = L.marker(this.markerToHover.coords, {
                    className:'fs-marker',
                    icon:L.icon({
                        iconUrl:this.getIconCategory(type),  
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    })
                }).addTo(this.map);

                markerToHover.bindTooltip(fs.lib_fs, {
                    className: this.getTooltipCategory(type),
                    direction:'top',
                    sticky:true,
                }).openTooltip();

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
                this.depFilter = e.resultCode;
            }
        },
        updateBuffer(new_radius) {
            if(this.buffer.options.radius) {
                this.buffer.setRadius(new_radius);
                this.flyToBoundsWithOffset(this.buffer);
            }
        },
        clearMap() {
            this.fs_cards = '';
            this.markerToHover.coordinates = '';
            this.clickedMarkerLayer.clearLayers();
            this.bufferLayer.clearLayers();
            this.adressLayer.clearLayers();
            this.map.flyTo(this.mapOptions.center, this.mapOptions.zoom);
        },
        // check if app is loaded in an iframe
        checkWindowLocation(ifTrue, ifFalse) {
            if ( window.location === window.parent.location ) {	  
                // console.log("iframe : False")
                return ifTrue;
            } else {	  
                // console.log("iframe : true")
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

                let circle_markers = L.layerGroup({});

                for(let i=0; i<fs_tab_fetched.length; i++) {
                    e = fs_tab_fetched[i];

                    circle = L.circleMarker([e.latitude, e.longitude], this.circles)
                                .on("mouseover", (e) => { 
                                    this.onMouseover(e.sourceTarget.content);
                                    this.getMarkertoHover(e.sourceTarget.content.matricule)
                                })
                                .on("mouseout", () => { 
                                    this.onMouseOut();
                                })
                                .on("click", (e) => { 
                                    this.displayInfo(e.sourceTarget.content);
                                });
                    circle.setStyle({fillColor:this.getMarkerColor(e)})
                    circle.content = e;
                    circle_markers.addLayer(circle);
                };

                this.map.addLayer(circle_markers);
            }
        },
    },
    watch: {
        marker() {
            let list_points = [];

            // reset everything : clear layers, previous clicked markers
            this.clearMap();

            // drop marker of searched address on map
            if(this.marker) {
                address_marker = L.marker(this.marker)
                .bindTooltip(this.marker_tooltip, {
                    permanent:true, 
                    direction:"top", 
                    className:'leaflet-tooltip-result'
                }).openTooltip();

                this.adressLayer.addLayer(address_marker)
            };

            // convert data lat lng to featureCollection
            this.data.forEach(feature => {
                list_points.push(turf.point([feature.latitude, feature.longitude], {id: feature.matricule}))
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

            let closest_points = list_points.features.slice(0, 20);

            // send ids of found fs to data prop
            closest_fs = [];
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
            
            this.fs_cards = closest_fs.sort((a,b) => {
                if(a.distance > b.distance) {
                    return 1;
                } else if (a.distance < b.distance) {
                    return -1
                } else if (a.distance === b.distance) {
                    return 0
                }
            });

            // create buffer 
            radius = this.fs_cards[4].distance*1000;
            perimetre_recherche = this.buffer.setRadius(radius);
            this.bufferLayer.addLayer(perimetre_recherche);
            // pan map view to circle with offset from sidebar
            this.flyToBoundsWithOffset(perimetre_recherche);
        },
        depFilter() {
            // clear address layers (buffer + pin address)
            this.adressLayer.clearLayers();
            this.bufferLayer.clearLayers();
            this.fs_cards = '';

            // filter data with matching departement code and send it to cards
            this.fs_cards = this.data.filter(e => {
                return e.departement == this.depFilter
            }).sort((a,b) => {
                let compare = 0;
                a.lib_fs > b.lib_fs ? compare = 1 : compare = 0;
                return compare 
            });
            // purge object from distance property (computed in 'address' search)
            this.fs_cards.forEach(e => delete e.distance)


            // draw departement borders
            dep_filter_geom = new L.GeoJSON(this.geom_dep, {
                interactive:false,
                filter:(feature) => {
                    return feature.properties.insee_dep == this.depFilter;
                },
                style: {
                    fillOpacity:0,
                    color:"red",
                    opacity:1,
                    weight:2
                }
            });
            this.bufferLayer.addLayer(dep_filter_geom);

            // pan to dep borders
            this.flyToBoundsWithOffset(dep_filter_geom)
        },
    },
    mounted() {
        session_data = JSON.parse(sessionStorage.getItem("session_local"));

        if(!session_data) {
            init();
        } else {
            page_status = "loaded";
            loading.remove();
            this.data = session_data;
            fs_tab_fetched = session_data;
        };

        this.initMap();
        this.checkPageStatus();
        this.loadDep();
    },
};


// finale instance vue
let vm = new Vue({
    el: '#app',
    components: {
        'leaflet-map': map_template,
    },
});
