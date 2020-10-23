package main

import (
	"github.com/gin-gonic/gin"
	"myModule/config"
	"myModule/db"
	"myModule/redis"
	"myModule/router"
	"strconv"
)

func main() {
	config.InitGlobalConfig()
	globalConfig := config.GlobalConfig
	//初始化redis
	done := make(chan bool)
	redis.InitRedis(globalConfig.Redis, done)
	<-done
	//初始化数据库
	db.InitDB(globalConfig.Db)
	//初始化gin
	r := gin.Default()
	router.InitRoutes(r)
	_ = r.Run(":" + strconv.Itoa(globalConfig.Port))
}
