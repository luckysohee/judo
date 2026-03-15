import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import MarkerLegend from "../../components/Map/MarkerLegend";

import Header from "../../components/Header/Header";
import SearchBar from "../../components/SearchBar/SearchBar";
import CuratorFilterBar from "../../components/CuratorFilterBar/CuratorFilterBar";
import MapView from "../../components/Map/MapView";
import PlacePreviewCard from "../../components/PlaceCard/PlacePreviewCard";
import PlaceDetail from "../../components/PlaceDetail/PlaceDetail";
import SaveFolderModal from "../../components/SaveFolderModal/SaveFolderModal";
import SavedPlaces from "../../components/SavedPlaces/SavedPlaces";
import CuratorPage from "../../components/CuratorPage/CuratorPage";
import AddPlaceForm from "../../components/AddPlaceForm/AddPlaceForm";
import CuratorApplyForm from "../../components/CuratorApplyForm/CuratorApplyForm";

import { fetchSupabaseCurators } from "../../utils/supabaseCurators";
import { places } from "../../data/places";
import { curators as baseCurators } from "../../data/curators";

import {
  getFolders,
  getSavedPlacesMap,
  getPlaceFolderIds,
  getPrimarySavedFolderColor,
  isPlaceSaved,
  savePlaceToFolder,
} from "../../utils/storage";

import parseNaturalQuery from "../../utils/parseNaturalQuery";
import { getCustomPlaces } from "../../utils/customPlacesStorage";

export default function Home() {

  const navigate = useNavigate();

  const [query,setQuery] = useState("");

  const [selectedPlace,setSelectedPlace] = useState(null);
  const [detailPlace,setDetailPlace] = useState(null);

  const [saveTargetPlace,setSaveTargetPlace] = useState(null);

  const [folders,setFolders] = useState([]);
  const [savedMap,setSavedMap] = useState({});

  const [savedPlacesOpen,setSavedPlacesOpen] = useState(false);

  const [customPlaces,setCustomPlaces] = useState([]);

  const [addPlaceOpen,setAddPlaceOpen] = useState(false);
  const [curatorApplyOpen,setCuratorApplyOpen] = useState(false);

  const [dbCurators,setDbCurators] = useState([]);

  const [selectedCurators,setSelectedCurators] = useState([]);

  useEffect(()=>{
    refreshStorage();
    refreshCustomPlaces();
    refreshDbCurators();
  },[]);

  function refreshStorage(){
    setFolders(getFolders());
    setSavedMap(getSavedPlacesMap());
  }

  function refreshCustomPlaces(){
    setCustomPlaces(getCustomPlaces());
  }

  async function refreshDbCurators(){
    const data = await fetchSupabaseCurators();
    setDbCurators(data || []);
  }

  const allPlaces = useMemo(()=>{
    return [...customPlaces,...places];
  },[customPlaces]);

  const parsedQuery = useMemo(()=>parseNaturalQuery(query),[query]);

  const curatorColorMap = useMemo(()=>{
    const map={};
    baseCurators.forEach(c=>map[c.name]=c.color);
    return map;
  },[]);

  const savedColorMap = useMemo(()=>{
    const map={};
    allPlaces.forEach(p=>{
      map[p.id] = getPrimarySavedFolderColor(p.id,folders);
    });
    return map;
  },[allPlaces,folders,savedMap]);

  const filteredPlaces = useMemo(()=>{

    let result=[...allPlaces];

    if(selectedCurators.length>0){

      result=result.filter(place=>
        place.curators.some(c=>selectedCurators.includes(c))
      );

    }

    if(parsedQuery.remainingText){

      const q=parsedQuery.remainingText.toLowerCase();

      result=result.filter(place=>
        place.name.toLowerCase().includes(q)
      );

    }

    return result;

  },[allPlaces,selectedCurators,parsedQuery]);

  const handleCuratorToggle = (name)=>{

    setSelectedCurators(prev=>{

      if(prev.includes(name)){
        return prev.filter(c=>c!==name);
      }

      return [...prev,name];

    });

  };

  const handleSelectAllCurators = ()=>{
    setSelectedCurators(baseCurators.map(c=>c.name));
  };

  return (

    <div style={styles.page}>

      <Header/>

      <div style={styles.content}>

        <div style={styles.mapSection}>

          <MapView
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            curatorColorMap={curatorColorMap}
            savedColorMap={savedColorMap}
          />

          <div style={styles.curatorOverlay}>

            <CuratorFilterBar
              curators={baseCurators}
              selectedCurators={selectedCurators}
              onToggle={handleCuratorToggle}
              onSelectAll={handleSelectAllCurators}
            />

            <div style={styles.legendOverlay}>
              <MarkerLegend />
            </div>

          </div>

          <div style={styles.keywordOverlay}>

            {query.trim() && (
              <div style={styles.keywordBox}>
                검색 결과 {filteredPlaces.length}개
              </div>
            )}

          </div>

          <div style={styles.searchOverlay}>

            <SearchBar
              query={query}
              setQuery={setQuery}
              placeholder="예: 을지로 2차 노포"
            />

          </div>

          <div style={styles.mapCardOverlay}>

            {selectedPlace && (

              <PlacePreviewCard
                place={selectedPlace}
                isSaved={isPlaceSaved(selectedPlace.id)}
                savedFolderColor={savedColorMap[selectedPlace.id]}
                onSave={setSaveTargetPlace}
                onOpenDetail={(p)=>setDetailPlace(p)}
                onClose={()=>setSelectedPlace(null)}
              />

            )}

          </div>

        </div>

      </div>

      <div style={styles.bottomBar}>

        <button
          style={styles.bottomButton}
          onClick={()=>setSavedPlacesOpen(true)}
        >
          내⭐저장
        </button>

        <button
          style={styles.bottomButton}
          onClick={()=>setAddPlaceOpen(true)}
        >
          + 술집 추가
        </button>

      </div>

      <PlaceDetail
        place={detailPlace}
        isSaved={detailPlace ? isPlaceSaved(detailPlace.id) : false}
        onClose={()=>setDetailPlace(null)}
        onSave={setSaveTargetPlace}
      />

      <SaveFolderModal
        open={!!saveTargetPlace}
        place={saveTargetPlace}
        folders={folders}
        savedFolderIds={
          saveTargetPlace ? getPlaceFolderIds(saveTargetPlace.id) : []
        }
        onClose={()=>setSaveTargetPlace(null)}
        onSaveToFolder={(placeId,folderId)=>{
          savePlaceToFolder(placeId,folderId);
          refreshStorage();
        }}
      />

      <SavedPlaces
        open={savedPlacesOpen}
        folders={folders}
        onClose={()=>setSavedPlacesOpen(false)}
      />

      <AddPlaceForm
        open={addPlaceOpen}
        curators={baseCurators}
        onClose={()=>setAddPlaceOpen(false)}
        onAdded={refreshCustomPlaces}
      />

      <CuratorApplyForm
        open={curatorApplyOpen}
        onClose={()=>setCuratorApplyOpen(false)}
      />

    </div>

  );

}

const styles = {

  page:{
    minHeight:"100vh",
    background:"#111",
    color:"#fff"
  },

  content:{
    padding:"8px 10px 16px"
  },

  mapSection:{
    position:"relative",
    height:"78vh",
    borderRadius:"20px",
    overflow:"hidden"
  },

  curatorOverlay:{
    position:"absolute",
    top:"10px",
    left:"10px",
    right:"10px",
    zIndex:20
  },

  keywordOverlay:{
    position:"absolute",
    bottom:"78px",
    left:"10px",
    right:"10px",
    zIndex:20
  },

  keywordBox:{
    background:"#1b1b1b",
    padding:"10px",
    borderRadius:"10px",
    fontSize:"13px"
  },

  searchOverlay:{
    position:"absolute",
    bottom:"18px",
    left:"10px",
    right:"10px",
    zIndex:20
  },

  mapCardOverlay:{
    position:"absolute",
    bottom:"140px",
    left:0,
    right:0,
    zIndex:30,
    pointerEvents:"none"
  },

  bottomBar:{
    position:"fixed",
    bottom:0,
    left:0,
    right:0,
    display:"flex",
    gap:"10px",
    padding:"12px",
    background:"#111",
    borderTop:"1px solid #2a2a2a"
  },

  bottomButton:{
    flex:1,
    height:"44px",
    borderRadius:"12px",
    border:"none",
    background:"#1e1e1e",
    color:"#fff",
    fontWeight:"700"
  },

  summaryWrap: {
  border: "1px solid rgba(255,255,255,0.06)",
  backgroundColor: "rgba(17,17,17,0.92)",
  borderRadius: "14px",
  padding: "8px 10px",
  backdropFilter: "blur(8px)",
},

summaryTitle: {
  fontSize: "11px",
  fontWeight: 700,
  color: "#ffffff",
},

summaryCount: {
  fontSize: "10px",
  color: "#bdbdbd",
},

summaryChip: {
  border: "1px solid #333333",
  backgroundColor: "#1f1f1f",
  color: "#f4f4f4",
  borderRadius: "999px",
  padding: "5px 8px",
  fontSize: "10px",
},

legendOverlay: {
  position: "absolute",
  top: "58px",
  right: "10px",
  zIndex: 20,
},

};
