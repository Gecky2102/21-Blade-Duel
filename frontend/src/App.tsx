import React from 'react';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import Home from './pages/Home';
import './index.css';

export default function App() {
  return (
    <Provider store={store}>
      <Home />
    </Provider>
  );
}
