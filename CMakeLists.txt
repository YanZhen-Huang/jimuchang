cmake_minimum_required(VERSION 3.16)
project(jimuchang VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets WebEngineWidgets WebChannel HttpServer)

file(GLOB_RECURSE WEB_FILES CONFIGURE_DEPENDS RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}"
     "${CMAKE_CURRENT_SOURCE_DIR}/web/*")
list(FILTER WEB_FILES EXCLUDE REGEX "\\.map$")

qt_add_executable(jimuchang src/main.cpp src/apiserver.cpp src/apiserver.h)

qt_add_resources(jimuchang "webrsrc"
    PREFIX "/"
    BASE "${CMAKE_CURRENT_SOURCE_DIR}/web"
    FILES ${WEB_FILES}
)

target_link_libraries(jimuchang PRIVATE
    Qt6::Widgets
    Qt6::WebEngineWidgets
    Qt6::WebChannel
    Qt6::HttpServer
)
