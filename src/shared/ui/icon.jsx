import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// 화면 아이콘은 Font Awesome Free(Solid)를 쓴다. 아이콘 CC BY 4.0, 코드 MIT. 쓰는 것만 불러와 번들을 작게 한다.
export {
  faArrowUp, faBriefcase, faBullhorn, faChevronLeft, faChevronRight, faCrown, faDesktop, faEnvelope, faFaceSadTear,
  faFileSignature, faGear, faMedal, faMobileScreenButton, faMoon, faNewspaper, faShoePrints, faSun, faTable, faTrophy, faUserTie,
  faVolumeHigh, faVolumeXmark,
} from '@fortawesome/free-solid-svg-icons';

/** 장식용 아이콘(읽어 주지 않음). 뜻은 옆 글이나 버튼 이름이 전한다. */
export function Icon({ icon, className = '', style }) {
  return <FontAwesomeIcon icon={icon} aria-hidden="true" className={className} style={style} />;
}
