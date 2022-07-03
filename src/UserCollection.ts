import User from './user'

interface UserCollection<T extends User> {

  /**
   * get all users
   */
  get all(): ReadonlyArray<T>

  /**
   * get the number of users
   */
  get size(): number

  /**
   * find user by id
   * @param id id of the user
   */
  find(id: string): T | undefined

  /**
   * check if a user exists
   * @param user user to check
   */
  includes(user: T): boolean

}

export default UserCollection