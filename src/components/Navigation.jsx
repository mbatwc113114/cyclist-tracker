import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Map, PlusCircle, Users, User } from 'lucide-react';

export default function Navigation() {
  return (
    <nav className="nav-bar glass-panel" style={{borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, zIndex: 9999}}>
      <div className="nav-links" style={{width: '100%', display: 'flex', justifyContent: 'space-around'}}>
        
        <NavLink to="/dashboard" className={({isActive}) => isActive ? "active" : ""}>
          <Home size={24} />
          <span className="nav-text">Home</span>
        </NavLink>
        
        <NavLink to="/maps" className={({isActive}) => isActive ? "active" : ""}>
          <Map size={24} />
          <span className="nav-text">Maps</span>
        </NavLink>
        
        <NavLink to="/record" className="record-btn" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--accent-color)'}}>
          <PlusCircle size={40} fill="var(--bg-dark)" strokeWidth={1.5} />
          <span className="nav-text" style={{marginTop: '-4px'}}>Record</span>
        </NavLink>

        <NavLink to="/clubs" className={({isActive}) => isActive ? "active" : ""}>
          <Users size={24} />
          <span className="nav-text">Clubs</span>
        </NavLink>
        
        <NavLink to="/profile" className={({isActive}) => isActive ? "active" : ""}>
          <User size={24} />
          <span className="nav-text">You</span>
        </NavLink>

      </div>
    </nav>
  );
}
