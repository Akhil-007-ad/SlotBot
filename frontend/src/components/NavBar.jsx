import React from 'react'
import { VscSignOut } from "react-icons/vsc";
import { NavLink } from 'react-router-dom';
const NavBar = ({ account, instance, isAdmin }) => {
    const navItems = [
        {
            id: 1,
            name: "Home",
            path: "/"
        },
        {
            id: 2,
            name: "History",
            path: "/history"
        },
        ...(isAdmin ? [{
            id: 3,
            name: "Admin",
            path: "/admin"
        }] : [])

    ]
    return (
        <div>
            {/* Header */}
            <header className="flex w-full justify-between items-center bg-white/70 backdrop-blur-xl border-b border-slate-200 px-5 py-3 sticky top-0 z-10">
                <div className="flex flex-col gap-0">
                    <h1 className="font-bold text-2xl text-violet-900">
                        Welcome to SlotBot
                    </h1>

                    <span className="text-sm text-slate-500 font-medium">
                        Signed in as {account.name || account.username}
                    </span>
                </div>
                <div className='flex items-center gap-3'>
                    <div className='flex gap-5 items-center'>
                        {navItems.map((item, index) => (
                            <NavLink to={item.path} key={index} className={({ isActive }) => isActive ? 'bg-violet-800 text-white px-3 py-1 rounded-lg font-semibold transition-all' : 'text-slate-500 px-3 py-1 font-semibold hover:text-violet-600'}>{item.name}</NavLink>
                        ))}
                    </div>
                    <button
                        onClick={() =>
                            instance.logoutRedirect({ account })
                        }
                        className="text-sm flex items-center justify-center gap-1 text-violet-600 font-semibold border border-violet-200 hover:bg-violet-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                        <VscSignOut />Sign out
                    </button>
                </div>

            </header>
        </div>
    )
}

export default NavBar
