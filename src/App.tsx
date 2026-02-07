import './App.css'
// Try one of these two imports depending on your WorldSim file:
import InventoryGrid from './InventoryGrid';
// import { WorldSim } from './WorldSim'; 

function App() {
  return (
    // "App" class often has default centering styles in Vite
    // You might want to remove className="App" if the layout looks weird
    <div className="App">
      <InventoryGrid />
    </div>
  )
}

export default App